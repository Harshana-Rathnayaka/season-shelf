import test from "node:test";
import assert from "node:assert/strict";
import { advanceDiscovery } from "../src/ui/features/discovery/flow.ts";

test("sole series result starts its bot then joins; multiple results stop for selection",async()=>{
  const calls=[];
  const call=async(method,payload)=>{
    calls.push([method,payload]);
    if(method === "discovery-search") return {messages:[{links:[{id:"series",automatic:true}]}]};
    if(method === "discovery-follow" && payload.id === "series") return {messages:[{links:[{id:"channel",automatic:true}]}]};
    if(method === "discovery-follow") return {channel:{id:"channel"}};
    return {channel:{id:"joined"}};
  };
  const result=await advanceDiscovery("discovery-search",{}, {call,cancelled:()=>false,onStage(){}});
  assert.equal(result.joined.channel.id,"joined");
  assert.deepEqual(calls.map(call=>call[0]),["discovery-search","discovery-follow","discovery-follow","discovery-join"]);
  let count=0;
  const multiple={messages:[{links:[{id:"a",automatic:true},{id:"b",automatic:true}]}]};
  assert.equal(await advanceDiscovery("discovery-search",{}, {call:async()=>{count++;return multiple;},cancelled:()=>false,onStage(){}}),multiple);
  assert.equal(count,1);
});

test("navigation controls never auto-run, cancellation stops before joining, and loops are bounded",async()=>{
  let count=0;
  const navigation={messages:[{links:[{id:"page",automatic:false}]}]};
  await advanceDiscovery("discovery-search",{}, {call:async()=>{count++;return navigation;},cancelled:()=>false,onStage(){}});
  assert.equal(count,1);
  let cancelled=false;
  const result=await advanceDiscovery("discovery-follow",{}, {call:async()=>{cancelled=true;return {channel:{id:"x"}};},cancelled:()=>cancelled,onStage(){}});
  assert.equal(result,null);
  await assert.rejects(advanceDiscovery("discovery-follow",{}, {call:async()=>({messages:[{links:[{id:"loop",automatic:true}]}]}),cancelled:()=>false,onStage(){}}),/too many redirects/);
});
