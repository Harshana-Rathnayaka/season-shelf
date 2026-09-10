import test from "node:test";
import assert from "node:assert/strict";
import { Discovery } from "../src/desktop/discovery.mjs";

function fixture(client) {
  let time=0;
  return new Discovery({requireClient:()=>client},{now:()=>time,wait:async(ms)=>{time+=ms;},timeout:12000});
}
const bot={className:"User",bot:true,id:1};
const group={className:"Channel",megagroup:true,id:22,title:"MovieClubFamily Chat"};
const groupClient=(extra={})=>({getEntity:async value=>value === "MCF_SeriesBot" ? bot : group,getInputEntity:async value=>value,...extra});
const reply=(id,start)=>({id,senderId:1,message:`Series ${id}`,replyMarkup:{rows:[{buttons:[{text:`Result ${id}`,url:`https://t.me/MCF_SeriesBot?start=${start}`}]}]}});

test("search requires a previewed group and validates query without sending",async()=>{
  let sent=false;
  const service=fixture({getEntity:async()=>({className:"Channel"}),sendMessage:async()=>{sent=true;}});
  await assert.rejects(service.search("Banshee"),/Find the MovieClubFamily search group/);
  await assert.rejects(service.search("/start"),/series name/);
  assert.equal(sent,false);
});

test("search posts to the shared group and collects only the bot's replies to that query",async()=>{
  let poll=0;
  let posts=0;
  const answer=(id,start)=>({...reply(id,start),replyTo:{replyToMsgId:10}});
  const service=fixture(groupClient({sendMessage:async(peer,options)=>{posts++;assert.equal(peer,group);assert.equal(options.message,"Banshee");return {id:10};},getMessages:async(peer,options)=>{
    assert.equal(peer,group);assert.equal(options.replyTo,10);
    poll++;
    return [answer(9,"old"),answer(11,poll>1 ? "edited" : "initial"),...(poll>1 ? [answer(12,"two")] : []),{...answer(13,"foreign"),senderId:2},reply(14,"no_reply_link"),{...answer(15,"other_request"),replyTo:{replyToMsgId:8}}];
  }}));
  const {source}=await service.prepareSearch();
  assert.equal(posts,0);
  const result=await service.search("Banshee",source.id);
  assert.equal(result.messages.length,2);
  assert.equal(service.choices.get(result.messages[0].links[0].id).start,"edited");
  assert.equal(service.operation,null);
  assert.equal(posts,1);
  await assert.rejects(service.search("Banshee",source.id),/Find the MovieClubFamily/);
});

test("follow starts only the configured bot and uses the result's start parameter",async()=>{
  const requests=[];
  const service=fixture({getEntity:async()=>bot,getInputEntity:async e=>e,getMessages:async()=>[],invoke:async request=>{requests.push(request);}});
  service.choices.set("one",{kind:"bot-start",username:"MCF_SeriesBot",start:"series_12"});
  const result=await service.follow("one");
  assert.equal(requests[0].className,"messages.StartBot");
  assert.equal(requests[0].startParam,"series_12");
  assert.equal(result.timedOut,true);
  service.choices.set("other",{kind:"bot-start",username:"OtherBot",start:"x"});
  await assert.rejects(service.follow("other"),/another bot/);
  assert.equal(requests.length,1);
});

test("channel preview does not join; explicit join validates entity and returns scan identity",async()=>{
  let joins=0;
  const channel={className:"Channel",broadcast:true,left:true,id:99,accessHash:123,title:"Banshee"};
  const service=fixture({getEntity:async()=>channel,getInputEntity:async e=>e,invoke:async request=>{assert.equal(request.className,"channels.JoinChannel");joins++;}});
  service.choices.set("channel",{kind:"public-peer",username:"BansheeSeries"});
  assert.equal((await service.follow("channel")).channel.title,"Banshee");
  assert.equal(joins,0);
  assert.equal((await service.join("channel")).peer.id,"99");
  assert.equal(joins,1);
  channel.broadcast=false;
  await assert.rejects(service.join("channel"),/not a broadcast/);
  await assert.rejects(service.join("fake"),/expired/);
});

test("cancellation stops waiting and frees the next search",async()=>{
  let service;
  service=fixture(groupClient({sendMessage:async()=>({id:10}),getMessages:async()=>{service.cancel();return [];}}));
  const {source}=await service.prepareSearch();
  await assert.rejects(service.search("Banshee",source.id),{name:"AbortError"});
  assert.equal(service.operation,null);
});

test("pasted private message resolves through accessible dialogs and exposes real start link without sending",async()=>{
  const entity={className:"Channel",id:1301811144,accessHash:55};
  let reads=0;
  const service=fixture({
    getInputEntity:async value=>{if(value.className === "PeerChannel") throw Error("Not cached");assert.equal(value,entity);return entity;},
    async *iterDialogs(){yield {entity};},
    getMessages:async(peer,options)=>{reads++;assert.equal(peer,entity);assert.deepEqual(options.ids,[10288467]);return [reply(10288467,"BreakingBad_real_payload")];},
    sendMessage:async()=>assert.fail("Reading must not send"),
    invoke:async()=>assert.fail("Reading must not start or join"),
  });
  const result=await service.openMessageLink("https://t.me/c/1301811144/10288467");
  assert.equal(reads,1);
  assert.equal(service.choices.get(result.messages[0].links[0].id).start,"BreakingBad_real_payload");
});

test("message links in bot replies follow the same read-only path; missing private messages fail clearly",async()=>{
  const service=fixture({getInputEntity:async()=>({}),getMessages:async()=>[]});
  service.choices.set("message",{kind:"private-message",channelId:"1301811144",messageId:10288467});
  await assert.rejects(service.follow("message"),/deleted or is not accessible/);
  await assert.rejects(service.openMessageLink("https://t.me/MCF_SeriesBot?start=x"),/private Telegram message link/);
});

test("bare configured bot link offers an explicit start action without immediately sending",async()=>{
  const service=fixture({getEntity:async()=>bot,invoke:async()=>assert.fail("Preview must not invoke start")});
  service.choices.set("bot",{kind:"public-peer",username:"MCF_SeriesBot"});
  const result=await service.follow("bot");
  assert.equal(service.choices.get(result.messages[0].links[0].id).start,"");
});

test("broadcast entry resolves its linked discussion group before the query form is offered",async()=>{
  const entry={className:"Channel",broadcast:true,id:99,title:"Waiting Area"};
  const service=fixture(groupClient({getEntity:async()=>entry,invoke:async request=>{
    assert.equal(request.className,"channels.GetFullChannel");
    return {fullChat:{linkedChatId:22},chats:[entry,group]};
  }}));
  const {source}=await service.prepareSearch();
  assert.equal(source.title,group.title);assert.equal(source.linked,true);
});

test("unlinked channels, restricted groups and user accounts cannot become search destinations",async()=>{
  for(const entity of [{className:"User",bot:true}, {...group,left:true}, {...group,forum:true}, {...group,bannedRights:{sendMessages:true}}]) {
    const service=fixture(groupClient({getEntity:async()=>entity}));
    await assert.rejects(service.prepareSearch());
    assert.equal(service.searchSource,null);
  }
  const service=fixture(groupClient({getEntity:async()=>({className:"Channel",broadcast:true}),invoke:async()=>({fullChat:{},chats:[]}),async *iterDialogs(){}}));
  assert.deepEqual((await service.prepareSearch()).groups,[]);
});

test("plain Start sends /start rather than an invalid empty startBot parameter",async()=>{
  let sent;
  const service=fixture({getEntity:async()=>bot,getMessages:async()=>[],sendMessage:async(peer,value)=>{assert.equal(peer,bot);sent=value.message;},invoke:async()=>assert.fail("No empty startBot request")});
  service.choices.set("start",{kind:"bot-start",username:"MCF_SeriesBot",start:""});
  await service.follow("start");
  assert.equal(sent,"/start");
});

test("entry channels without a linked group offer joined groups for explicit selection",async()=>{
  let posts=0;
  const client=groupClient({getEntity:async value=>value === "MovieClubFamily" ? {className:"Channel",broadcast:true,id:99} : value === "MCF_SeriesBot" ? bot : group,
    invoke:async()=>({fullChat:{},chats:[]}),
    async *iterDialogs(){yield {entity:bot};yield {entity:{...group,id:77,left:true}};yield {entity:group};},
    sendMessage:async()=>{posts++;return {id:10};},getMessages:async()=>[]});
  const service=fixture(client);
  const {groups}=await service.prepareSearch();
  assert.equal(groups.length,1);assert.equal(groups[0].title,group.title);
  assert.equal(posts,0);
  await assert.rejects(service.prepareSearch("made-up"),/expired/);
  const {source}=await service.prepareSearch(groups[0].id);
  assert.equal(posts,0);
  await service.search("Breaking Bad",source.id);
  assert.equal(posts,1);
});
