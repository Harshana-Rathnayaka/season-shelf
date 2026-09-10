import test from "node:test";
import assert from "node:assert/strict";
import { TelegramAdapter } from "../src/desktop/telegram.mjs";
test("adapter uses current Teleproto range API and emits concurrent chunks in order", async () => {
  const data = Buffer.alloc(524288 * 5 + 61);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  const media = {},
    calls = [];
  const adapter = new TelegramAdapter({});
  adapter.connected = true;
  adapter.client = {
    getEntity: async () => ({}),
    getMessages: async () => [
      { document: { id: "doc", size: data.length }, media },
    ],
    async *iterDownload(file, options) {
      assert.equal(file, media);
      assert.equal(options.limit, 524288);
      assert.ok(options.signal);
      const start = Number(options.offset);
      calls.push(start);
      yield data.subarray(
        start,
        Math.min(start + options.requestSize, data.length),
      );
    },
  };
  const output = [];
  for await (const chunk of adapter.download(
    {
      peer: { id: "1", type: "chat" },
      id: "1",
      documentId: "doc",
      size: data.length,
    },
    524288,
    new AbortController().signal,
  ))
    output.push(chunk);
  assert.deepEqual(Buffer.concat(output), data.subarray(524288));
  assert.equal(calls.length, 5);
});
test("adapter rejects a changed source before requesting file bytes", async () => {
  const adapter = new TelegramAdapter({});
  adapter.connected = true;
  adapter.client = {
    getEntity: async () => ({}),
    getMessages: async () => [{ document: { id: "new", size: 4 } }],
  };
  await assert.rejects(async () => {
    for await (const _ of adapter.download(
      { peer: { id: "1", type: "chat" }, id: "1", documentId: "old", size: 4 },
      0,
      new AbortController().signal,
    )) {
    }
  }, /changed/);
});

test("saved sessions reconnect without interactive prompts", async () => {
  const session="1"+Buffer.concat([Buffer.from([2,0,9]),Buffer.from("127.0.0.1"),Buffer.from([1,187]),Buffer.alloc(256)]).toString("base64");
  let connected=0,saved;
  const adapter=new TelegramAdapter({loadCredentials:()=>({apiId:123,apiHash:"a".repeat(32),session}),saveCredentials:value=>saved=value,
    ask:()=>{throw new Error("Must not prompt");},notify(){},
    createClient:()=>({setLogLevel(){},connect:async()=>{connected++;},start:async()=>{throw new Error("Must not start interactive login");},getMe:async()=>({firstName:"Test",lastName:"Viewer",username:"viewer",phone:"private",id:"private"}),checkAuthorization:async()=>true,session:{save:()=>session},disconnect:async()=>{}})});
  assert.deepEqual(await adapter.connect(null,{interactive:false}),{connected:true,profile:{name:"Test Viewer",username:"viewer"}});
  assert.equal(connected,1);assert.equal(saved.session,session);
  assert.equal(adapter.connecting,false);
});
test("expired saved sessions fail quietly and remain available for explicit sign-in", async () => {
  const session="1"+Buffer.concat([Buffer.from([2,0,9]),Buffer.from("127.0.0.1"),Buffer.from([1,187]),Buffer.alloc(256)]).toString("base64");
  let disconnected=0;
  const adapter=new TelegramAdapter({loadCredentials:()=>({apiId:123,apiHash:"a".repeat(32),session}),saveCredentials:()=>{throw Error("Must not persist failed login");},ask:()=>{throw Error("No prompts");},notify(){},
    createClient:()=>({setLogLevel(){},connect:async()=>{},checkAuthorization:async()=>false,disconnect:async()=>{disconnected++;}})});
  await assert.rejects(adapter.connect(null,{interactive:false}),/Sign-in was not completed/);
  assert.equal(adapter.connected,false);assert.equal(adapter.connecting,false);assert.equal(disconnected,1);
});
