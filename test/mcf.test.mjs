import test from 'node:test';
import assert from 'node:assert/strict';
import { Api } from 'teleproto';
import { Discovery } from '../src/desktop/discovery.mjs';
import { TelegramAdapter } from '../src/desktop/telegram.mjs';
import { deliveryCatalogue } from '../src/desktop/bot-delivery.mjs';
import { updateSelection, botActionHint, isExpiredSearchNotice } from '../src/desktop/mcf.mjs';
import { missingEpisodes } from '../src/core/collection.mjs';
import { advanceDiscovery } from '../src/ui/features/discovery/flow.ts';

const helper1={className:'User',bot:true,id:1,accessHash:11,username:'MCFHelper01Bot'};
const helper2={className:'User',bot:true,id:2,accessHash:22,username:'MCFHelper02Bot'};
const group={className:'Channel',megagroup:true,id:99,title:'MCF group'};
const callback=(text,data)=>({className:'KeyboardButtonCallback',text,data:Buffer.from(data)});
const keyboard=(buttons,text='Choose',id=11)=>({id,senderId:1,message:text,replyTo:{replyToMsgId:10},replyMarkup:{rows:[{buttons}]}});
function file(id,episode,{bot=2,doc=id,resolution=1080,season=1,name='The.Flash',...rest}={}) {
  return {id,senderId:bot,message:'',document:{id:doc,size:1024,attributes:[{className:'DocumentAttributeFilename',fileName:`${name}.S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}.${resolution}p.x265.mkv`}]},...rest};
}
function serviceFor(client,{timeout=15000,deliveryTimeout=45000,wait}={}) {
  let time=0;
  const service=new Discovery({requireClient:()=>client},{now:()=>time,wait:async ms=>{time+=ms;await wait?.(service,time);},timeout,deliveryTimeout});
  return {service,now:()=>time};
}

test('MCF helper flow follows Sinhala menus, explicit quality and a second helper DM with late episode delivery',async()=>{
  let menu=keyboard([callback('The Flash (2014)','series')]);let started=false,startTime=0;const actions=[];
  let f;
  const client={getEntity:async value=>value==='MovieClubFamily'||value===group?group:value==='MCFHelper01Bot'?helper1:value==='MCFHelper02Bot'?helper2:Promise.reject(Error('USERNAME_NOT_OCCUPIED')),
    getInputEntity:async entity=>entity,
    sendMessage:async(peer,value)=>{assert.equal(peer,group);assert.equal(value.message,'The Flash');return {id:10};},
    getMessages:async(peer,options)=>{
      if(peer===group)return [menu];
      assert.equal(peer,helper2);
      if(options.limit===1)return [{id:200,out:true}];
      if(!started || f.now()-startTime<20000)return [];
      return [file(199,7),file(201,1),file(202,2),file(203,1,{doc:201}),file(204,3,{bot:999}),file(205,3,{noforwards:true})];
    },
    invoke:async request=>{
      actions.push(request.className);
      if(request.className==='messages.StartBot'){assert.equal(request.bot,helper2);assert.equal(request.startParam,'opaque_delivery');started=true;startTime=f.now();return {};}
      assert.equal(request.className,'messages.GetBotCallbackAnswer');
      const data=request.data.toString();
      if(data==='series')menu=keyboard([callback('Season 1','season'),callback('Season 2','season2')]);
      else if(data==='season')menu=keyboard([callback('\u0db8\u0dd4\u0dc5\u0dd4 Season \u0d91\u0d9a\u0db8 \u0d9c\u0db1\u0dca\u0db1','all'),callback('E01 - Pilot','episode')]);
      else {assert.equal(data,'all');menu=keyboard([{text:'1080p - Episodes 2',url:'https://t.me/MCFHelper02Bot?start=opaque_delivery'},{text:'720p - Episodes 2',url:'https://t.me/MCFHelper02Bot?start=other'}]);}
      return {};
    }};
  f=serviceFor(client);const {service}=f;
  const recentData={};
  service.store={get:(key,fallback)=>recentData[key] ?? fallback,set:(key,value)=>{recentData[key]=structuredClone(value);}};
  const {source}=await service.prepareSearch();
  let result=await service.search('The Flash',source.id);
  assert.equal(result.messages.length,1);assert.equal(result.messages[0].links[0].automatic,false);
  result=await service.follow(result.messages[0].links[0].id);
  assert.equal(result.messages[0].links.length,2);
  result=await service.follow(result.messages[0].links[0].id);
  assert.equal(result.messages[0].links[0].hint,'Download entire season');
  result=await service.follow(result.messages[0].links[0].id);
  assert.ok(result.messages[0].links.every(link=>link.automatic===false));
  result=await service.follow(result.messages[0].links[0].id);
  const c=result.catalogue;
  assert.equal(c.source,'bot');assert.equal(c.channel.title,'The Flash (2014)');
  assert.equal(c.items.length,2);assert.deepEqual(c.items.map(item=>item.id),['201','202']);
  assert.equal(c.items[0].peer.type,'user');assert.equal(c.items[0].peer.id,'2');
  assert.equal(c.delivery.complete,true);assert.equal(c.delivery.expected,2);assert.equal(c.delivery.afterId,200);
  assert.match(c.sourceWarning,/deleted/);
  assert.deepEqual(actions,['messages.GetBotCallbackAnswer','messages.GetBotCallbackAnswer','messages.GetBotCallbackAnswer','messages.StartBot']);
  assert.equal(service.operation,null);
  const recent=recentData.recentSeries[0];
  assert.equal(recent.title,'The Flash (2014)');assert.equal(recent.query,'The Flash');
  assert.equal(recent.season,1);assert.equal(recent.resolution,1080);
  assert.equal(recent.shortcut.peer.id,'99');assert.equal(recent.shortcut.messageId,11);
  assert.equal(recent.searchPeer.id,'99');
});

test('private callback deliveries respect the pre-click message boundary',async()=>{
  const menu=keyboard([callback('720p - Episodes 1','quality')],'Quality',40);menu.senderId=2;
  let pressed=false;
  const f=serviceFor({getMessages:async(_peer,options)=>options.ids?[menu]:options.limit===1?[{id:50}]:pressed?[file(45,9,{resolution:720}),file(51,1,{resolution:720})]:[],
    invoke:async()=>{pressed=true;return {};}});
  f.service.selection={title:'The Flash (2014)',season:1};
  const result=f.service.presentMessages([menu],helper2);
  const delivery=await f.service.follow(result.messages[0].links[0].id);
  assert.deepEqual(delivery.catalogue.items.map(item=>item.id),['51']);
});

test('callbacks may send separate replies to the clicked message instead of editing it',async()=>{
  const menu=keyboard([callback('The Flash (2014)','series')]);
  const next={...keyboard([callback('Season 1','one')],'Seasons',12),replyTo:{replyToMsgId:11}};
  let pressed=false;
  const f=serviceFor({getMessages:async(_peer,options)=>options.ids?[menu]:pressed?[menu,next]:[menu],invoke:async()=>{pressed=true;return {};}});
  const result=f.service.presentMessages([menu],group,{queryId:10,botIds:['1']});
  const after=await f.service.follow(result.messages[0].links[0].id);
  assert.equal(after.messages.length,1);assert.equal(after.messages[0].text,'Seasons');
});

test('partial season deliveries remain visibly incomplete and can be checked without sending another start',async()=>{
  let count=1,starts=0;
  const client={getMessages:async()=>Array.from({length:count},(_,i)=>file(201+i,i+1)),invoke:async()=>starts++};
  const f=serviceFor(client,{deliveryTimeout:12000});f.service.selection={title:'The Flash (2014)',season:1,resolution:1080,expected:2};
  const first=await f.service.responses(client,helper2,200,new AbortController().signal);
  assert.equal(first.catalogue.delivery.complete,false);assert.match(first.catalogue.sourceWarning,/1 of 2/);
  count=2;const second=await f.service.collectDelivery();
  assert.equal(second.catalogue.items.length,2);assert.equal(second.catalogue.delivery.complete,true);assert.equal(starts,0);
});

test('pagination collects more than 100 delivered messages without crossing the request boundary',async()=>{
  const all=Array.from({length:125},(_,i)=>file(201+i,i+1)).reverse();const offsets=[];
  const f=serviceFor({getMessages:async(_peer,options)=>{offsets.push(options.offsetId);return all.filter(m=>m.id>options.minId && (!options.offsetId || m.id<options.offsetId)).slice(0,options.limit);}});
  const read=await f.service.readRecent(f.service.adapter.requireClient(),helper2,200,new AbortController().signal);
  assert.equal(read.messages.length,125);assert.equal(read.truncated,false);assert.equal(offsets.length,2);
});

test('cancellation stops delivery collection and does not publish a cached batch',async()=>{
  const client={getMessages:async()=>[file(201,1)]};
  const f=serviceFor(client,{wait:service=>service.cancel()});f.service.selection={resolution:1080,expected:2};
  await assert.rejects(f.service.run((client,signal)=>f.service.responses(client,helper2,200,signal)),{name:'AbortError'});
  assert.equal(f.service.operation,null);assert.equal(f.service.delivery,undefined);
});

test('saved delivery can be reread after restart, but a changed bot identity cannot access it',async()=>{
  const saved=deliveryCatalogue([file(201,1)],helper2,{title:'The Flash (2014)',expected:1});saved.delivery.afterId=200;
  const client={getEntity:async()=>helper2,getMessages:async()=>[file(201,1)]};
  const f=serviceFor(client);assert.equal((await f.service.collectDelivery(saved)).catalogue.items.length,1);
  const other=serviceFor({...client,getEntity:async()=>({...helper2,id:999})});
  await assert.rejects(other.service.collectDelivery(saved),/identity changed/);
});

test('series delivered through the same bot have separate collection identity and missing checks',()=>{
  const first=deliveryCatalogue([file(1,1)],helper2,{title:'First show (2014)'});
  const second=deliveryCatalogue([file(2,1)],helper2,{title:'Second show (2020)'});
  assert.notEqual(first.channel.id,second.channel.id);
  const jobs=[{status:'complete',mode:'archive',item:first.items[0]}];
  assert.equal(missingEpisodes(first.items,jobs,first.channel.id,'archive').length,0);
  assert.equal(missingEpisodes(second.items,jobs,second.channel.id,'archive').length,1);
  const mixed=deliveryCatalogue([file(1,1),file(2,2,{name:'Different.Show'})],helper2,{title:'The Flash (2014)'});
  assert.ok(mixed.items.every(item=>item.reason));
});

test('bot peers download through InputPeerUser and expired attachments have an actionable error',async()=>{
  const adapter=new TelegramAdapter({});adapter.connected=true;
  let gone=false;
  adapter.client={getEntity:async input=>{assert.equal(input.className,'InputPeerUser');assert.equal(input.userId.toString(),'2');return helper2;},
    getMessages:async()=>gone?[]:[{document:{id:'doc',size:1},media:{}}],async *iterDownload(){yield Buffer.from([42]);}};
  const item={id:'201',documentId:'doc',size:1,peer:{id:'2',type:'user',accessHash:'22'}};
  const received=[];for await(const chunk of adapter.download(item,0,new AbortController().signal))received.push(chunk);
  assert.deepEqual(Buffer.concat(received),Buffer.from([42]));gone=true;
  await assert.rejects(async()=>{for await(const _ of adapter.download(item,0,new AbortController().signal)){}},/Request the season again/);
});

test('catalogue results terminate discovery without attempting to join the bot as a channel',async()=>{
  let calls=0;const catalogue=deliveryCatalogue([file(1,1)],helper2);
  const result=await advanceDiscovery('discovery-follow',{id:'quality'},{call:async()=>{calls++;return {catalogue};},cancelled:()=>false,onStage(){}});
  assert.equal(result.catalogue,catalogue);assert.equal(calls,1);
  assert.equal(botActionHint('\u0d86\u0db4\u0dc3\u0dd4'),'Back');
  assert.equal(updateSelection({title:'The Flash (2014)'},'1080p - Episodes 23').expected,23);
});

test('real Telegram media records retain filenames, reject protected files and refresh only saved message IDs',async()=>{
  const media=new Api.MessageMediaDocument({document:new Api.Document({id:123,size:1024,attributes:[new Api.DocumentAttributeFilename({fileName:'The.Flash.S01E01.720p.x265.mkv'})]})});
  const message={id:201,senderId:2,media};
  const saved=deliveryCatalogue([message,{...message,id:202,noforwards:true}],helper2,{title:'The Flash (2014)'});
  assert.equal(saved.items.length,1);assert.equal(saved.items[0].documentId,'123');
  const adapter=new TelegramAdapter({});adapter.connected=true;
  adapter.client={getMessages:async(peer,options)=>{assert.equal(peer.className,'InputPeerUser');assert.deepEqual(options.ids,[201]);return [];}};
  const refreshed=await adapter.refreshDelivery(saved);
  assert.equal(refreshed.items.length,0);assert.match(refreshed.sourceWarning,/deleted/);
});

test('account resets invalidate private delivery state and previous menu buttons',async()=>{
  const f=serviceFor({});const result=f.service.presentMessages([keyboard([callback('Season 1','one')])],group);
  f.service.delivery={client:f.service.adapter.requireClient()};
  f.service.reset();
  await assert.rejects(f.service.follow(result.messages[0].links[0].id),/expired/);
  await assert.rejects(f.service.collectDelivery(),/Choose a season/);
});

test('helper menus require explicit choices even for a single untranslated channel link',()=>{
  const {service}=serviceFor({});service.helperIds=new Set(['1']);
  const menu=keyboard([{text:'\u0d86\u0db4\u0dc3\u0dd4',url:'https://t.me/ExampleSeriesChannel'}]);
  const result=service.presentMessages([menu],group);
  assert.equal(result.messages[0].links[0].automatic,false);
});

test('changing season or returning to full-season selection clears previous episode and quality filters',()=>{
  const previous={season:1,episode:3,resolution:720,expected:1};
  assert.deepEqual(updateSelection(previous,'Season 2'),{season:2});
  assert.deepEqual(updateSelection(previous,'Full season'),{season:1});
  assert.equal(updateSelection({expected:23},'1080p').expected,undefined);
});

test('refresh preserves mixed-series review warnings and excludes changed documents',async()=>{
  const messages=[file(201,1),file(202,2,{name:'Another.Show'})];
  const saved=deliveryCatalogue(messages,helper2,{title:'The Flash (2014)',expected:2},{complete:true});
  const adapter=new TelegramAdapter({});adapter.connected=true;
  adapter.client={getMessages:async()=>messages};
  const refreshed=await adapter.refreshDelivery(saved);
  assert.ok(refreshed.items.every(item=>item.reason));assert.equal(refreshed.delivery.received,0);
  adapter.client.getMessages=async()=>[file(201,1,{doc:999})];
  assert.equal((await adapter.refreshDelivery(saved)).items.length,0);
});

test('group search reads history rather than stripped reply threads and retains menus over empty hydration',async()=>{
  const menu=new Api.Message({id:11,fromId:new Api.PeerUser({userId:1}),replyTo:new Api.MessageReplyHeader({replyToMsgId:10}),
    message:'The Flash',replyMarkup:new Api.ReplyInlineMarkup({rows:[new Api.KeyboardButtonRow({buttons:[
      new Api.KeyboardInlineButton({text:'The Flash (2014)',type:new Api.InlineButtonTypeCallback({data:Buffer.from('flash')})})]})]})});
  let polls=0;
  const client={getEntity:async value=>value==='MCFHelper01Bot'?helper1:group,getInputEntity:async value=>value,
    sendMessage:async()=>({id:10}),getMessages:async(_peer,options)=>{
      assert.equal(options.replyTo,undefined,'A normal group reply must not use GetReplies');polls++;
      return options.ids?[new Api.Message({id:11})]:[menu,{...keyboard([callback('Wrong show','wrong')],'Another search',12),replyTo:{replyToMsgId:9}}];
    }};
  const {service}=serviceFor(client);const {source}=await service.prepareSearch();
  const result=await service.search('The Flash',source.id);
  assert.ok(polls>1);assert.equal(result.messages.length,1);
  assert.equal(result.messages[0].text,'The Flash');assert.equal(result.messages[0].links[0].label,'The Flash (2014)');
});

test('blank Telegram records produce an actionable timeout instead of an empty results section',async()=>{
  const {service}=serviceFor({getMessages:async()=>[{id:11,senderId:1,replyTo:{replyToMsgId:10}}]});
  const result=await service.responses(service.adapter.requireClient(),group,10,new AbortController().signal,{botIds:['1']});
  assert.deepEqual(result.messages,[]);assert.match(result.notice,/Read linked message/);
});

test('chat refresh includes supported MCF bot DMs with distinct IDs and excludes personal or unrelated bot chats',async()=>{
  const adapter=new TelegramAdapter({});adapter.connected=true;
  adapter.client={async *iterDialogs(){
    for(const entity of [helper1,helper2,{...helper2,id:3,username:'MCFHelper03Bot'},
      {...helper1,bot:false,id:4},{...helper1,id:5,username:'UnrelatedBot'}, {...group,id:1}])
      yield {entity,title:entity.username||'MCF group'};
  }};
  const chats=await adapter.channels();
  assert.deepEqual(chats.map(chat=>chat.id),['user:1','user:2','user:3','1']);
  assert.equal(chats[0].peer.type,'user');assert.equal(chats[0].source,'bot');
});

test('opening an existing helper DM reads episodes without starting bots and treats mixed series as unverified',async()=>{
  const adapter=new TelegramAdapter({});adapter.connected=true;
  let historyReads=0;
  adapter.client={getEntity:async()=>helper2,invoke:async request=>{
    assert.equal(request.className,'messages.GetHistory');historyReads++;
    return {messages:historyReads===1?[file(202,2),file(201,1)]:[]};
  }};
  const chat={id:'user:2',title:'MCF Helper 2',source:'bot',peer:{id:'2',type:'user',accessHash:'22'}};
  const result=await adapter.scan(chat);
  assert.equal(result.source,'bot');assert.equal(result.items.length,2);assert.ok(result.items.every(item=>!item.reason));
  assert.equal(result.channel.title,'The Flash');
  historyReads=0;adapter.client.invoke=async request=>{
    assert.equal(request.className,'messages.GetHistory');
    return {messages:historyReads++===0?[file(202,2),file(201,1,{name:'Another.Show'})]:[]};
  };
  assert.ok((await adapter.scan(chat)).items.every(item=>item.reason));
  adapter.client.getEntity=async()=>({...helper2,username:'UnrelatedBot'});
  await assert.rejects(adapter.scan(chat),/not a supported MCF bot/);
});

test('discovery uses raw adapter history so SDK empty placeholders cannot hide group menus',async()=>{
  const adapter=new TelegramAdapter({});adapter.connected=true;
  const menu=keyboard([callback('The Flash (2014)','flash')]);let time=0;
  adapter.client={invoke:async request=>{
    assert.equal(request.className,'messages.GetHistory');
    return {messages:request.offsetId?[]:[new Api.MessageEmpty({id:0}),menu]};
  },getMessages:async(_peer,options)=>{assert.ok(options.ids,'Only explicit hydration uses the SDK iterator');return [menu];}};
  const service=new Discovery(adapter,{now:()=>time,wait:async ms=>{time+=ms;}});
  const result=await service.responses(adapter.client,group,10,new AbortController().signal,{botIds:['1']});
  assert.equal(result.messages[0].links[0].label,'The Flash (2014)');
});

test('checking a selected inbox replaces an older cached delivery from a different helper',async()=>{
  const saved=deliveryCatalogue([file(201,1)],helper2,{title:'The Flash (2014)',expected:1});saved.delivery.afterId=200;
  const client={getEntity:async name=>{assert.equal(name,'MCFHelper02Bot');return helper2;},
    getMessages:async peer=>{assert.equal(peer,helper2);return [file(201,1)];}};
  const {service}=serviceFor(client);service.delivery={client,bot:helper1,afterId:10,selection:{title:'Old show'}};
  assert.equal((await service.collectDelivery(saved)).catalogue.channel.title,'The Flash (2014)');
});

const expiredNotice='මේ search එක පරණ වෙලා. නම ආයෙත් group එකේ type කරන්න.';

test('Sinhala expired-search alerts invalidate the menu immediately without polling or repeating callbacks',async()=>{
  const menu=keyboard([callback('Season 1','s1')]);let calls=0;
  const {service}=serviceFor({getMessages:async()=>[menu],invoke:async()=>{calls++;return {alert:true,message:expiredNotice};}},
    {wait:()=>assert.fail('Expired alerts must not start polling')});
  service.resumeSearch={query:'The Flash'};
  const result=service.presentMessages([menu],group,{queryId:10,botIds:['1']});
  const choice=result.messages[0].links[0].id;
  const expired=await service.follow(choice);
  assert.equal(expired.expired,true);assert.deepEqual(expired.messages,[]);assert.equal(expired.notice,expiredNotice);
  assert.equal(calls,1);assert.equal(service.resumeTarget,null);assert.equal(service.resumeSearch,null);
  await assert.rejects(service.follow(choice),/expired/);assert.equal(calls,1);
});

test('invalid callback IDs show expiry but transient bot timeouts remain ordinary errors',async()=>{
  const menu=keyboard([callback('Season 1','s1')]);let code='BUTTON_DATA_INVALID';
  const {service}=serviceFor({getMessages:async()=>[menu],invoke:async()=>{throw Object.assign(Error(code),{errorMessage:code});}});
  let result=service.presentMessages([menu],group);
  assert.equal((await service.follow(result.messages[0].links[0].id)).expired,true);
  code='BOT_RESPONSE_TIMEOUT';result=service.presentMessages([menu],group);
  await assert.rejects(service.follow(result.messages[0].links[0].id),/BOT_RESPONSE_TIMEOUT/);
});

test('plain expiry replies stop delivery waiting and subscription alerts are surfaced without being marked expired',async()=>{
  const {service}=serviceFor({getMessages:async()=>[{id:20,senderId:2,message:expiredNotice}]},
    {wait:()=>assert.fail('Do not wait for a delivery after an expiry notice')});
  service.selection={resolution:1080,expected:23};
  assert.equal((await service.responses(service.adapter.requireClient(),helper2,10,new AbortController().signal)).expired,true);
  const menu=keyboard([callback('Season 1','s1')]);
  const subscription=serviceFor({getMessages:async()=>[menu],invoke:async()=>({alert:true,message:'Join the required channel first.'})});
  const result=subscription.service.presentMessages([menu],group,{queryId:10,botIds:['1']});
  const answer=await subscription.service.follow(result.messages[0].links[0].id);
  assert.match(answer.notice,/required channel/);assert.equal(!!answer.expired,false);
});

test('expiry wording is recognised without misclassifying subscription failures or temporary delays',()=>{
  for(const text of [expiredNotice,'This search has expired. Search again.','This menu is too old.','Expired search','This button is no longer valid.'])
    assert.equal(isExpiredSearchNotice(text),true,text);
  for(const text of ['Please join the required channels.','Your subscription expired. Join the channel and search again.','The bot did not respond in time.','Search again if no result matches.'])
    assert.equal(isExpiredSearchNotice(text),false,text);
});
