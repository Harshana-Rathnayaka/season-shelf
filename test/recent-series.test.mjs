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
  const client={getEntity:async()=>bot,getInputEntity:async peer=>peer,getMessages:async()=>[menu],sendMessage:async()=>assert.fail('Resume must not post a group search'),invoke:async()=>assert.fail('Reopening a saved message must not start a bot or press buttons')};
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

test('rechecking a saved delivery after restart preserves its existing menu reference',()=>{
  const f=fixture();f.remember();
  const restored=f.create();
  restored.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3,resolution:720}}});
  assert.equal(f.data.recentSeries[0].shortcut.messageId,42);
});

test('shared-group season menus restore their peer and validate the original sender',async()=>{
  const f=fixture();
  f.service.selection={title:'Breaking Bad (2008)'};
  f.service.presentMessages([menu],{className:'InputPeerChannel',channelId:123,accessHash:88},{manual:true});
  f.service.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3}}});
  f.client.getMessages=async peer=>{assert.equal(peer.className,'PeerChannel');assert.equal(String(peer.channelId),'123');return [menu];};
  assert.equal((await f.create().resumeSeries('breaking bad 2008')).messages[0].links.length,2);
});

for(const reason of ['deleted','sender changed']) test(`${reason} menu offers a prefilled search without sending`,async()=>{
  const f=fixture();f.remember();
  f.client.getMessages=async()=>reason==='deleted'?[]:[{...menu,senderId:123}];
  const restored=f.create();
  restored.prepareSearch=async()=>({source:{id:'fresh-source',title:'MovieClubFamily'}});
  const result=await restored.resumeSeries('breaking bad 2008');
  assert.equal(result.query,'Breaking Bad (2008)');
  assert.equal(result.source.id,'fresh-source');
  assert.match(result.notice,/fresh search/);
  assert.equal(restored.operation,null);
});

test('missing private menus do not replay a saved start link or trigger a new delivery',async()=>{
  const f=fixture();
  f.remember();f.client.getMessages=async()=>[];
  const restored=f.create();
  f.data.recentSeries[0].shortcut.start={kind:'bot-start',username:bot.username,start:'breaking_bad'};
  restored.prepareSearch=async()=>({source:{id:'fresh',title:'MCF'}});
  assert.equal((await restored.resumeSeries('breaking bad 2008')).query,'Breaking Bad (2008)');
});

test('an old fingerprint does not reject the same message edited into a quality menu',async()=>{
  const f=fixture();f.remember();
  const record=f.data.recentSeries[0];
  record.shortcut.fingerprint='The season-picker snapshot from 1.2.10';
  const edited={...menu,message:'Breaking Bad (2008) — Season 3',replyMarkup:{rows:[{buttons:[
    {text:'720p · Episodes 13',url:'https://t.me/MCFHelper01Bot?start=season3'},
    {className:'KeyboardButtonCallback',text:'⬅ ආපසු',data:Buffer.from('back')},
  ]}]}};
  f.client.getMessages=async()=>[edited];
  const restored=f.create();
  restored.prepareSearch=async()=>assert.fail('An accessible edited menu needs no new search');
  const result=await restored.resumeSeries(record.id);
  assert.equal(result.messages[0].text,edited.message);
  assert.deepEqual(result.messages[0].links.map(link=>link.label),['720p · Episodes 13','⬅ ආපසු']);
  assert.equal(restored.selection.season,3);
  assert.ok(result.messages[0].links.every(link=>!link.automatic));
});

test('a pasted quality-only menu is remembered even without visiting its season selector',async()=>{
  const f=fixture();
  const quality={...menu,message:'Breaking Bad (2008) — Season 3',replyMarkup:{rows:[{buttons:[
    {text:'720p · Episodes 13',url:'https://t.me/MCFHelper01Bot?start=season3'},
  ]}]}};
  f.client.getMessages=async()=>[quality];
  await f.service.openMessageLink('https://t.me/c/123/42');
  f.service.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3,resolution:720}}});
  assert.equal(f.data.recentSeries[0].shortcut.messageId,42);
  const restored=f.create();
  assert.equal((await restored.resumeSeries('breaking bad 2008')).messages[0].text,quality.message);
});

test('saved channel references use the pasted-link dialog resolution when no access hash is cached',async()=>{
  const f=fixture();
  f.service.presentMessages([menu],{className:'InputPeerChannel',channelId:123,accessHash:88},{manual:true});
  f.service.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3}}});
  const channel={className:'Channel',id:123,accessHash:88};
  f.client.getInputEntity=async peer=>{if(peer.className==='PeerChannel')throw Error('No cached peer');return peer;};
  f.client.iterDialogs=async function*(){yield {entity:channel};};
  f.client.getMessages=async peer=>{assert.equal(peer,channel);return [menu];};
  assert.equal((await f.create().resumeSeries('breaking bad 2008')).messages[0].links.length,2);
});

test('the same edited quality message supports Back and two more seasons without posting a search',async()=>{
  const f=fixture();
  const group={className:'InputPeerChannel',channelId:123,accessHash:88};
  const callback=(text,data)=>({className:'KeyboardButtonCallback',text,data:Buffer.from(data)});
  const keyboard=(text,buttons)=>({...menu,message:text,replyMarkup:{rows:[{buttons}]}});
  const quality=season=>keyboard(`Breaking Bad (2008) — Season ${season}`,[
    {text:'720p · Episodes 1',url:`https://t.me/MCFHelper01Bot?start=season${season}`},callback('⬅ ආපසු','back'),
  ]);
  let current=quality(3),deliveredSeason,starts=0,time=0;
  f.service.selection={title:'Breaking Bad (2008)',season:3};
  f.service.presentMessages([current],group,{manual:true});
  f.service.rememberSeries({channel:{title:'Breaking Bad (2008)'},items:[{}],delivery:{selection:{season:3,resolution:720}}});
  f.client.getInputEntity=async peer=>peer.className==='PeerChannel'?group:peer;
  f.client.getMessages=async(peer,options)=>{
    if(peer===group)return [current];
    if(options.limit===1 || !deliveredSeason)return [];
    return [{id:201,senderId:bot.id,message:'',document:{id:deliveredSeason,size:1024,attributes:[
      {className:'DocumentAttributeFilename',fileName:`Breaking.Bad.S0${deliveredSeason}E01.720p.mkv`},
    ]}}];
  };
  f.client.invoke=async request=>{
    if(request.className==='messages.StartBot') {
      starts++;deliveredSeason=Number(request.startParam.replace('season',''));return {};
    }
    assert.equal(request.className,'messages.GetBotCallbackAnswer');
    assert.equal(request.msgId,42);
    const action=request.data.toString();
    current=action==='back'?keyboard('Choose a season',[callback('Season 4','4'),callback('Season 5','5')]):quality(Number(action));
    return {};
  };
  for(const season of [4,5]) {
    const restored=new Discovery(f.service.adapter,{store:f.store,now:()=>time,wait:async ms=>{time+=ms;}});
    restored.prepareSearch=async()=>assert.fail('Do not ask for a new group search');
    let result=await restored.resumeSeries('breaking bad 2008');
    assert.match(result.messages[0].text,/Season/);
    result=await restored.follow(result.messages[0].links.find(link=>link.kind==='callback').id);
    result=await restored.follow(result.messages[0].links.find(link=>link.label===`Season ${season}`).id);
    assert.equal(restored.selection.season,season);
    result=await restored.follow(result.messages[0].links.find(link=>link.kind==='bot-start').id);
    assert.equal(result.catalogue.delivery.selection.season,season);
    assert.equal(f.data.recentSeries[0].season,season);
    assert.equal(f.data.recentSeries[0].shortcut.messageId,42);
  }
  assert.equal(starts,2,'Only explicitly selected quality links start episode deliveries');
});

test('connection errors and cancellation do not masquerade as expired menus',async()=>{
  const f=fixture();f.remember();
  for(const error of [new Error('Network disconnected'),new DOMException('Stopped','AbortError')]) {
    f.client.getMessages=async()=>{throw error;};
    await assert.rejects(f.create().resumeSeries('breaking bad 2008'),value=>value===error);
  }
});

test('a resumed menu edited again before a click reloads current buttons without pressing an old callback',async()=>{
  const f=fixture();f.remember();
  const restored=f.create();
  const original=await restored.resumeSeries('breaking bad 2008');
  const changed={...menu,message:'Current season choices',replyMarkup:{rows:[{buttons:[
    {className:'KeyboardButtonCallback',text:'Season 5',data:Buffer.from('season_5')},
  ]}]}};
  f.client.getMessages=async()=>[changed];
  restored.prepareSearch=async()=>assert.fail('An edited accessible menu must be reread');
  const result=await restored.follow(original.messages[0].links[0].id);
  assert.deepEqual(result.messages[0].links.map(link=>link.label),['Season 5']);
});

test('a changed bot identity falls back to search without reading or starting the replacement bot',async()=>{
  const f=fixture();f.remember();
  f.client.getEntity=async()=>({...bot,id:999});
  f.client.getMessages=async()=>assert.fail('Do not read the replacement bot');
  const restored=f.create();restored.prepareSearch=async()=>({source:{id:'fresh',title:'MCF'}});
  assert.equal((await restored.resumeSeries('breaking bad 2008')).query,'Breaking Bad (2008)');
});
