import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { credentialStorage } from '../src/desktop/secure-storage.cjs';
import { loginMemory } from '../src/desktop/login-memory.cjs';
import { TelegramAdapter } from '../src/desktop/telegram.mjs';
import { Store } from '../src/core/store.mjs';
import { activateAccountWorkspace } from '../src/core/account-workspace.mjs';
import { orphanedPartials } from '../src/core/maintenance.mjs';

const encrypted = { isEncryptionAvailable:()=>true,
  encryptString:s=>Buffer.from(s.split('').reverse().join('')),
  decryptString:b=>b.toString().split('').reverse().join('') };
function memoryStore() {
  const data = {};
  return {data,get:(key,fallback)=>data[key] ?? fallback,set:(key,value)=>data[key]=value,
    setMany:entries=>Object.assign(data,structuredClone(entries))};
}

test('a fresh profile has no account and encrypted credentials store only reusable authentication fields', () => {
  const store=memoryStore(), storage=credentialStorage(store,encrypted,'win32');
  assert.equal(storage.loadCredentials(),null);
  assert.deepEqual(loginMemory(store,encrypted,'win32').list(),[]);
  storage.saveCredentials({apiId:123,apiHash:'test hash',session:'test session',password:'not saved',code:'not saved'});
  assert.doesNotMatch(JSON.stringify(store.data),/test hash|test session|not saved/);
  assert.deepEqual(storage.loadCredentials(),{apiId:123,apiHash:'test hash',session:'test session'});
  assert.equal(credentialStorage(memoryStore(),encrypted,'win32').loadCredentials(),null);
  storage.clearCredentials(); assert.equal(storage.loadCredentials(),null);
});

test('Linux basic_text is refused for reading and writing sessions and remembered logins', () => {
  const store=memoryStore();store.set('credentials','existing');store.set('loginSuggestions','existing');
  const insecure={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'basic_text',
    encryptString(){throw Error('Must not encrypt');},decryptString(){throw Error('Must not decrypt');}};
  const storage=credentialStorage(store,insecure,'linux');
  assert.throws(()=>storage.loadCredentials(),/Secure OS/);
  assert.throws(()=>storage.saveCredentials({apiId:1}),/Secure OS/);
  const suggestions=loginMemory(store,insecure,'linux');
  assert.deepEqual(suggestions.list(),[]);
  suggestions.save({apiId:1,apiHash:'test',phone:'test'});
  assert.equal(store.get('loginSuggestions'),'existing');
  storage.clearCredentials();assert.equal(storage.loadCredentials(),null);
});

function authFixture({ getMe=async()=>({id:2}), logout=async()=>true }={}) {
  const sessions=[], saved=[];let loads=0,cleared=0,disconnected=0;
  const adapter=new TelegramAdapter({
    loadCredentials:()=>{loads++;throw Error('Explicit login must not read another session');},
    saveCredentials:value=>saved.push(value),clearCredentials:()=>cleared++,notify(){},
    createClient:session=>{sessions.push(session.save());return {setLogLevel(){},start:async()=>{},
      checkAuthorization:async()=>true,getMe,session:{save:()=> 'new-session',delete(){}},
      disconnect:async()=>disconnected++,logOut:logout};},
  });
  return {adapter,sessions,saved,get loads(){return loads;},get cleared(){return cleared;},get disconnected(){return disconnected;}};
}

test('explicit details always create an empty session, including repeated API IDs',async()=>{
  const f=authFixture();
  await f.adapter.connect({apiId:123,apiHash:'a'.repeat(32),phone:'test-account-one'});
  await f.adapter.connect({apiId:123,apiHash:'a'.repeat(32),phone:'test-account-two'});
  assert.deepEqual(f.sessions,['','']); assert.equal(f.loads,0);
  assert.equal(f.adapter.accountId,'2'); assert.equal(f.saved.length,2);
});

test('an unverified identity never gets persisted or treated as signed in',async()=>{
  const f=authFixture({getMe:async()=>{throw Error('identity unavailable');}});
  await assert.rejects(f.adapter.connect({apiId:123,apiHash:'a'.repeat(32)}),/identity unavailable/);
  assert.equal(f.saved.length,0);assert.equal(f.adapter.authorized,false);
  assert.throws(()=>f.adapter.requireClient(),/Connect your Telegram/);
});

for(const offline of [false,true]) test(`logout clears credentials and access when Telegram is ${offline?'offline':'online'}`,async()=>{
  const f=authFixture({logout:async()=>{assert.equal(f.cleared,2);if(offline)throw Error('offline');return true;}});
  await f.adapter.connect({apiId:123,apiHash:'a'.repeat(32)});
  assert.deepEqual(await f.adapter.logout(),{revoked:!offline});
  assert.equal(f.adapter.client,null);assert.equal(f.adapter.profile,null);assert.equal(f.adapter.accountId,null);
  assert.throws(()=>f.adapter.requireClient(),/Connect your Telegram/);
});

async function workspaceFixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-account-test-'));
  const store=new Store(path.join(dir,'test.sqlite'));
  t.after(async()=>{store.close();await fs.rm(dir,{recursive:true,force:true});});
  const queue={store,staging:dir,jobs:[],usage:{payloadBytes:12},currentBatchId:'old',running:new Map(),removals:new Map(),
    namingLocks:new Set(),recovering:false,snapshot(){return structuredClone(this.jobs);}};
  const watcher={watches:[],checking:false};
  return {store,queue,watcher,activate:(accountId,adoptLegacy=false)=>activateAccountWorkspace({store,queue,watcher,accountId,adoptLegacy})};
}

test('a second sign-in cannot race an unfinished logout',async()=>{
  let finish;
  const wait=new Promise(resolve=>{finish=resolve;});
  const f=authFixture({logout:async()=>{await wait;return true;}});
  await f.adapter.connect({apiId:123,apiHash:'a'.repeat(32)});
  const logout=f.adapter.logout();
  await assert.rejects(f.adapter.connect({apiId:123,apiHash:'a'.repeat(32)}),/already in progress/);
  finish();await logout;assert.equal(f.adapter.loggingOut,false);
});

test('account switches isolate queues, channels, watches and usage without deleting partials',async t=>{
  const f=await workspaceFixture(t);f.activate('1',true);
  const id='12345678-1234-1234-1234-123456789012';
  f.queue.jobs=[{id,status:'paused',speed:42}];f.watcher.watches=[{channel:{id:'private-channel'}}];
  f.store.set('channels',[{id:'private-channel'}]);
  await fs.writeFile(path.join(f.queue.staging,`${id}.part`),'partial bytes');
  const next=f.activate('2');assert.deepEqual(next.jobs,[]);assert.deepEqual(next.channels,[]);
  assert.equal(next.usage.payloadBytes,0);assert.deepEqual(f.watcher.watches,[]);
  assert.deepEqual(await orphanedPartials(f.queue),[],'inactive account partials are protected from cleanup');
  const original=f.activate('1');assert.equal(original.jobs[0].id,id);
  assert.equal(original.usage.payloadBytes,12);assert.equal(f.watcher.watches[0].channel.id,'private-channel');
  assert.equal(await fs.readFile(path.join(f.queue.staging,`${id}.part`),'utf8'),'partial bytes');
});

test('fresh sign-ins cannot claim unassigned legacy data; only saved-session restoration can',async t=>{
  const f=await workspaceFixture(t);f.queue.jobs=[{id:'legacy',status:'paused'}];
  assert.deepEqual(f.activate('2').jobs,[]);
  assert.equal(f.store.get('accountWorkspace:legacy').jobs[0].id,'legacy');
  const restored=await workspaceFixture(t);restored.queue.jobs=[{id:'legacy',status:'paused'}];
  assert.equal(restored.activate('1',true).jobs[0].id,'legacy');
});

test('switching accounts waits for active work and does not change metadata on checkpoint failure',async t=>{
  const f=await workspaceFixture(t);f.activate('1',true);f.queue.running.set('job',{});
  assert.throws(()=>f.activate('2'),/current operations/);assert.equal(f.store.get('workspaceAccount'),'1');
  f.queue.running.clear();f.queue.jobs=[{id:'retained',status:'paused'}];
  f.store.setMany=()=>{throw Error('checkpoint failed');};
  assert.throws(()=>f.activate('2'),/checkpoint failed/);
  assert.equal(f.queue.jobs[0].id,'retained');assert.equal(f.store.get('workspaceAccount'),'1');
});
