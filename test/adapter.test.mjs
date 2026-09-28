import test from "node:test";
import assert from "node:assert/strict";
import { TelegramAdapter } from "../src/desktop/telegram.mjs";
import { Api } from "teleproto";
import { iterMessages } from "teleproto/client/messages.js";
import { selectEpisodes } from "../src/core/catalog.mjs";

const scanChannel = { id: "1", title: "Series", peer: { id: "1", type: "chat" } };
function historyAdapter(pages) {
  const requests = [];
  const adapter = new TelegramAdapter({ notify() {} });
  adapter.connected = true;
  adapter.client = {
    getEntity: async () => ({}),
    getInputEntity: async input => input,
    invoke: async request => {
      requests.push(request);
      return { messages: pages.shift() || [], users: [], chats: [] };
    },
  };
  return { adapter, requests };
}
function video(id, filename) {
  return new Api.Message({ id, message: filename, media: new Api.MessageMediaDocument({
    document: new Api.Document({ id: BigInt(id), size: 1000,
      attributes: [new Api.DocumentAttributeFilename({ fileName: filename })] }),
  }) });
}

test("scan survives the empty placeholder that prematurely ends the SDK iterator", async () => {
  const page = () => [new Api.MessageEmpty({ id: 0 }),
    video(10, "The.Boys.2019.S05E05.720p.10bit.WEBRip.2CH.x265.HEVC-PSA.mkv")];
  const legacy = historyAdapter([page()]);
  const oldResults = [];
  for await (const message of iterMessages(legacy.adapter.client, legacy.adapter.input(scanChannel.peer), { limit: 100 })) oldResults.push(message);
  assert.equal(oldResults.length, 0);
  const { adapter, requests } = historyAdapter([page()]);
  const result = await adapter.scan(scanChannel);
  assert.equal(result.scanned, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].reason, null);
  assert.equal(result.lastMessageId, 10);
  assert.equal(requests[1].offsetId, 10);
});

test("scan continues through short pages, separators and interleaved quality batches", async () => {
  const { adapter } = historyAdapter([
    [video(10, "The.Boys.S02E01.1080p.x265.mkv"), new Api.Message({ id: 9, message: "Season 02" })],
    [video(8, "The.Boys.S01E03.1080p.x264.mkv"), video(7, "The.Boys.S01E02.1080p.x264.mkv"), video(6, "The.Boys.S01E01.1080p.x264.mkv")],
    [new Api.Message({ id: 5, message: "720p x265" }), video(4, "The.Boys.S01E03.720p.x265.mkv"), video(3, "The.Boys.S01E02.720p.x265.mkv"), video(2, "The.Boys.S01E01.720p.x265.mkv")],
    [video(1, "Prison.Break.S02E01.Manhunt.HDTV.x264.MCF.mp4")],
  ]);
  const result = await adapter.scan(scanChannel);
  assert.equal(result.scanned, 10);
  assert.equal(result.items.length, 8);
  assert.deepEqual(selectEpisodes(result.items).map(item => item.episode), [1, 2, 3]);
  assert.equal(result.items.at(-1).reason, "Resolution is missing or conflicting");
  assert.equal(result.items.at(-1).season, 2);
});

test("history preserves incremental boundaries, scan limits and restrictions", async () => {
  const pages = () => [[new Api.Message({ id: 5 }), new Api.Message({ id: 4 }), new Api.Message({ id: 3 })]];
  const { adapter } = historyAdapter(pages());
  const incremental = await adapter.scan(scanChannel, { minId: 4 });
  assert.equal(incremental.scanned, 1);
  assert.equal(incremental.lastMessageId, 5);
  const limited = await historyAdapter(pages()).adapter.scan(scanChannel, { limit: 2 });
  assert.equal(limited.scanned, 2);
  assert.equal(limited.truncated, true);
  adapter.client.getEntity = async () => ({ noforwards: true });
  await assert.rejects(adapter.scan(scanChannel), /restricts saving/);
});

test("invalid or stalled history pages fail visibly instead of claiming a successful empty scan", async () => {
  await assert.rejects(historyAdapter([[new Api.MessageEmpty({ id: 0 })]]).adapter.scan(scanChannel), /unreadable channel history/);
  await assert.rejects(historyAdapter([[new Api.Message({ id: 5 })], [new Api.Message({ id: 5 })]]).adapter.scan(scanChannel), /unreadable channel history/);
  const { adapter } = historyAdapter([]);
  adapter.client.invoke = async () => { throw new Error("History unavailable"); };
  await assert.rejects(adapter.scan(scanChannel), /History unavailable/);
  assert.equal((await historyAdapter([]).adapter.scan(scanChannel)).scanned, 0);
});
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

test("range requests refill while the consumer is still writing the previous chunk", async () => {
  const block = 524288, calls = [];
  const adapter = new TelegramAdapter({});
  adapter.connected = true;
  adapter.client = {
    getEntity: async () => ({}),
    getMessages: async () => [{ document: { id: "doc", size: block * 10 }, media: {} }],
    async *iterDownload(_media, options) {
      calls.push(Number(options.offset));
      yield Buffer.alloc(block);
    },
  };
  const stream = adapter.download({ peer: { id: "1", type: "chat" }, id: "1", documentId: "doc", size: block * 10 }, 0, new AbortController().signal);
  const first = await stream.next();
  assert.equal(first.value.length, block);
  // The fallback window is four requests; consuming one starts its replacement
  // without waiting for the next next() call from the disk writer.
  assert.deepEqual(calls, [0, block, block * 2, block * 3, block * 4]);
  await stream.return();
  assert.equal(calls.length, 5);
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
