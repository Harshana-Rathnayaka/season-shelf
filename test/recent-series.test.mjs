import test from 'node:test';
import assert from 'node:assert/strict';
import {Discovery} from '../src/desktop/discovery.mjs';

const bot={className:'User',id:17,bot:true,username:'MCFHelper01Bot',accessHash:99};
const menu={id:42,senderId:17,message:'Breaking Bad (2008)',replyMarkup:{rows:[{buttons:[
  {className:'KeyboardButtonCallback',text:'Season 3',data:Buffer.from('season_3')},
  {className:'KeyboardButtonCallback',text:'Season 4',data:Buffer.from('season_4')},
]}]}};
function fixture() {
  const data={};
  const store={get:(key,fallback)=>structuredClone(data[key] ?? fallback),set:(key,value)=>{data[key]=structuredClone(value);}};
  const client={getEntity:async()=>bot,getMessages:async()=>[menu],sendMessage:async()=>assert.fail('Resume must not post a group search')};
  const adapter={requireClient:()=>client};
  const create=()=>new Discovery(adapter,{store});
  const service=create();
  const remember=(title='Breaking Bad (2008)',season=3)=>{
    service.selection={title};
    service.presentMessages([menu],bot,{manual:true});
    service.rememberSeries({channel:{title},items:[{}],delivery:{selection:{season,resolution:1080}}});
  };
  return {data,store,client,create,service,remember};
}

test('successful deliveries keep twelve distinct recent series with request metadata, not download claims',()=>{
  const f=fixture();
  f.remember();f.remember('Breaking Bad (2008)',4);
  assert.equal(f.data.recentSeries.length,1);
  assert.deepEqual(f.service.recentSeries(),[{id:'breaking bad 2008',title:'Breaking Bad (2008)',season:4,resolution:1080}]);
  f.service.rememberSeries({channel:{title:'Empty'},items:[]});
  assert.equal(f.data.recentSeries.length,1);
  for(let n=0;n<14;n++) f.remember(`Show ${n}`);
  assert.equal(f.data.recentSeries.length,12);
  assert.equal(f.data.recentSeries[0].title,'Show 13');
});

test('a restart restores the season menu with fresh choice IDs and no bot action',async()=>{
  const f=fixture();f.remember();
  const oldIds=[...f.service.choices.keys()];
  const restored=f.create();
  const result=await restored.resumeSeries('breaking bad 2008');
  assert.deepEqual(result.messages[0].links.map(link=>link.label),['Season 3','Season 4']);
  assert.ok(result.messages[0].links.every(link=>!oldIds.includes(link.id) && !link.automatic));
  assert.equal(restored.selection.title,'Breaking Bad (2008)');
});

test('shared-group season menus restore their peer and validate the original sender',async()=>{
  const f=fixture();
  f.service.selection={title:'Breaking Bad (2008)'};
  f.service.presentMessages([menu],{className:'InputPeerChannel',channelId:123,accessHash:88},{manual:true});
  f.service.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3}}});
  f.client.getMessages=async peer=>{assert.equal(peer.className,'InputPeerChannel');assert.equal(String(peer.channelId),'123');return [menu];};
  assert.equal((await f.create().resumeSeries('breaking bad 2008')).messages[0].links.length,2);
});

for(const reason of ['deleted','edited','sender changed']) test(`${reason} menu offers a prefilled search without sending`,async()=>{
  const f=fixture();f.remember();
  f.client.getMessages=async()=>reason==='deleted'?[]:[{...menu,...(reason==='edited'?{message:'A different series'}:{senderId:123})}];
  const restored=f.create();
  restored.prepareSearch=async()=>({source:{id:'fresh-source',title:'MovieClubFamily'}});
  const result=await restored.resumeSeries('breaking bad 2008');
  assert.equal(result.query,'Breaking Bad (2008)');
  assert.equal(result.source.id,'fresh-source');
  assert.match(result.notice,/fresh search/);
  assert.equal(restored.operation,null);
});

test('an edited private menu can be regenerated through its series-specific start link',async()=>{
  const f=fixture();
  f.service.seriesStart={kind:'bot-start',username:bot.username,start:'breaking_bad'};
  f.remember();f.client.getMessages=async()=>[];
  const restored=f.create();
  restored.follow=async id=>{
    const target=restored.choices.get(id);
    assert.equal(target.start,'breaking_bad');assert.equal(target.selection.title,'Breaking Bad (2008)');
    return {messages:[{text:'Pick season',links:[{label:'Season 4'}]}]};
  };
  assert.equal((await restored.resumeSeries('breaking bad 2008')).messages[0].text,'Pick season');
});

test('connection errors and cancellation do not masquerade as expired menus',async()=>{
  const f=fixture();f.remember();
  for(const error of [new Error('Network disconnected'),new DOMException('Stopped','AbortError')]) {
    f.client.getMessages=async()=>{throw error;};
    await assert.rejects(f.create().resumeSeries('breaking bad 2008'),value=>value===error);
  }
});

test('a changed bot identity falls back to search without reading or starting the replacement bot',async()=>{
  const f=fixture();f.remember();
  f.client.getEntity=async()=>({...bot,id:999});
  f.client.getMessages=async()=>assert.fail('Do not read the replacement bot');
  const restored=f.create();restored.prepareSearch=async()=>({source:{id:'fresh',title:'MCF'}});
  assert.equal((await restored.resumeSeries('breaking bad 2008')).query,'Breaking Bad (2008)');
});
