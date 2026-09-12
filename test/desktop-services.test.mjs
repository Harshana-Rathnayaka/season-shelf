import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';

async function load(file,dependency) {
  const context={exports:{},Buffer,require:()=>dependency,setTimeout:()=>({unref(){}}),setInterval:()=>({unref(){}}),clearTimeout(){},clearInterval(){}};
  vm.runInNewContext(await fs.readFile(file,'utf8'),context);
  return context.exports;
}
test('updater downloads automatically and refuses installation while work is active',async()=>{
  const updater=new EventEmitter();let downloads=0,installs=0,prepared=0,active=true;
  updater.downloadUpdate=async()=>{downloads++;};updater.quitAndInstall=()=>{installs++;};
  updater.checkForUpdates=async()=>{updater.emit('update-available',{version:'0.2.0'});};
  const handlers={};const settings={automaticUpdates:false};
  const {installUpdates}=await load('src/desktop/updates.cjs',{autoUpdater:updater});
  installUpdates({app:{isPackaged:true,getVersion:()=> '0.1.0'},handle:(name,fn)=>{handlers[name]=fn;},notify(){},settings:()=>settings,saveSettings(){},busy:()=>active,beforeInstall:async()=>{prepared++;}});
  assert.equal(updater.autoInstallOnAppQuit,false);
  await handlers['update-check']();assert.equal(downloads,1);

  updater.emit('update-downloaded',{version:'0.2.0'});
  await assert.rejects(handlers['update-install'](),/Pause downloads/);assert.equal(prepared,0);
  active=false;await handlers['update-install']();assert.equal(installs,1);assert.equal(prepared,1);
  await handlers['update-preference']({enabled:true});updater.emit('update-available',{version:'0.3.0'});assert.equal(downloads,2);
});
test('tray keeps the app open until explicit quit and notifies a completion only once',async()=>{
  const notices=[];let hidden=0,quitting=false,pauses=0,closeToTray=true;
  class Tray extends EventEmitter {setToolTip(){} setContextMenu(menu){this.menu=menu;}}
  class Notification extends EventEmitter {static isSupported(){return true;}constructor(value){super();notices.push(value);}show(){}}
  const {installTray}=await load('src/desktop/tray.cjs',{Tray,Notification,Menu:{buildFromTemplate:value=>value},nativeImage:{createFromBitmap:()=>({})},app:{quit:()=>{quitting=true;}}});
  const win=new EventEmitter();Object.assign(win,{hide:()=>{hidden++;},show(){},isMinimized:()=>false,focus(){}});
  const queue=new EventEmitter();queue.jobs=[];queue.controlAll=action=>{if(action==="pause")pauses++;};
  const tray=installTray({win,queue,settings:()=>({closeToTray}),isQuitting:()=>quitting});
  let prevented=0;win.emit('close',{preventDefault:()=>{prevented++;}});assert.equal(hidden,1);assert.equal(prevented,1);assert.equal(pauses,1);
  closeToTray=false;win.emit("close",{preventDefault:()=>{prevented++;}});assert.equal(pauses,2);assert.equal(hidden,1);
  const job={id:'1',status:'complete',item:{filename:'episode.mkv'}};queue.emit('change',[job]);queue.emit('change',[job]);assert.equal(notices.length,1);
  tray.menu.at(-1).click();win.emit('close',{preventDefault:()=>{prevented++;}});assert.equal(prevented,1);
});

test('unpublished releases get a friendly state without leaking provider errors',async()=>{
  const updater=new EventEmitter();
  updater.checkForUpdates=async()=>{throw new Error('0.1.0: No published versions on GitHub');};
  const handlers={};const {installUpdates}=await load('src/desktop/updates.cjs',{autoUpdater:updater});
  installUpdates({app:{isPackaged:true,getVersion:()=> '0.1.0'},handle:(name,fn)=>{handlers[name]=fn;},notify(){},settings:()=>({}),saveSettings(){},busy:()=>false});
  const status=await handlers['update-check']();assert.equal(status.state,'unpublished');assert.equal(status.message,'');
});

test('installed profile starts separately and retains data on subsequent launches',async t=>{
  const {default:os}=await import('node:os');const {default:path}=await import('node:path');
  const {configureProfile}=await import('../src/desktop/profile.cjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-profile-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dev=path.join(root,'season-shelf');await fs.mkdir(dev);await fs.writeFile(path.join(dev,'session'),'development session');
  let userData=dev;const app={isPackaged:false,getPath:name=>name==='appData'?root:userData,setPath:(name,value)=>{userData=value;}};
  configureProfile(app);assert.equal(userData,dev);
  app.isPackaged=true;configureProfile(app);assert.notEqual(userData,dev);assert.deepEqual(await fs.readdir(userData),[]);
  await fs.writeFile(path.join(userData,'session'),'installed session');configureProfile(app);
  assert.equal(await fs.readFile(path.join(userData,'session'),'utf8'),'installed session');
  assert.equal(await fs.readFile(path.join(dev,'session'),'utf8'),'development session');
});

test('Not now persists a verified update for installation after the next launch checks it',async()=>{
  const settings={};let installs=0;
  async function session(){const updater=new EventEmitter();updater.downloadUpdate=async()=>{};updater.quitAndInstall=()=>installs++;const handlers={};const {installUpdates}=await load('src/desktop/updates.cjs',{autoUpdater:updater});installUpdates({app:{isPackaged:true,getVersion:()=> '0.1.0'},handle:(n,f)=>handlers[n]=f,notify(){},settings:()=>settings,saveSettings(){},busy:()=>false,beforeInstall:async()=>{}});return {updater,handlers};}
  const first=await session();first.updater.emit('update-downloaded',{version:'0.2.0'});await first.handlers['update-later']();assert.equal(installs,0);assert.equal(settings.deferredUpdate,'0.2.0');
  const next=await session();assert.equal(installs,0);next.updater.emit('update-downloaded',{version:'0.2.0'});await new Promise(r=>setTimeout(r,0));assert.equal(installs,1);
});

test('login suggestions store only encrypted reusable fields, never session or verification secrets',async()=>{
  const {loginMemory}=await import('../src/desktop/login-memory.cjs');const entries={};const store={get:(k,d)=>entries[k]??d,set:(k,v)=>entries[k]=v};
  const secure={isEncryptionAvailable:()=>true,encryptString:text=>Buffer.from(text.split('').reverse().join('')),decryptString:buffer=>buffer.toString().split('').reverse().join('')};
  const memory=loginMemory(store,secure);memory.save({apiId:12,apiHash:'private-hash',phone:'+94123456789',password:'never-save',session:'never-save',code:'never-save'});
  assert.doesNotMatch(JSON.stringify(entries),/private-hash|94123456789|never-save/);
  const [suggestion]=memory.list();assert.equal(suggestion.apiHash,undefined);assert.equal(memory.get(suggestion.id).apiHash,'private-hash');
  assert.equal(memory.get(suggestion.id).password,undefined);memory.forget();assert.deepEqual(memory.list(),[]);
});

test('themed confirmations require the exact pending token and honour cancellation',async()=>{
  const {createConfirmations}=await import('../src/desktop/confirmations.cjs');const handlers={};let request;
  const confirm=createConfirmations({handle:(n,f)=>handlers[n]=f,notify:(type,data)=>request=data});const result=confirm({title:'Delete?',buttons:['Keep','Delete']});
  assert.throws(()=>handlers['confirmation-reply']({id:'wrong',response:1}),/expired/);
  handlers['confirmation-reply']({id:request.id,response:0});assert.equal((await result).response,0);
  assert.throws(()=>handlers['confirmation-reply']({id:request.id,response:1}),/expired/);
});
