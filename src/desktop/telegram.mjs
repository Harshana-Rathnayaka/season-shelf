import { createRequire } from "node:module";
const { version: appVersion } = createRequire(import.meta.url)("../../package.json");
import { rangeSource } from "./range-source.mjs";
import { TelegramClient, Api } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import bigInt from "big-integer";
import { parseEpisode } from "../core/catalog.mjs";

export class TelegramAdapter {
  constructor({ loadCredentials, saveCredentials, ask, notify, createClient }) {
    Object.assign(this, { loadCredentials, saveCredentials, ask, notify });
    this.client = null;
    this.connected = false;
    this.createClient = createClient || ((...args) => new TelegramClient(...args));
  }
  async connect(credentials, { interactive = true } = {}) {
    if (this.connecting) throw new Error("Sign-in is already in progress");
    this.connecting = true;
    try {
      const saved = this.loadCredentials();
      const auth = credentials || saved;
      if (
        !auth ||
        !Number.isInteger(Number(auth.apiId)) ||
        Number(auth.apiId) <= 0 ||
        !/^[a-f0-9]{32}$/i.test(auth.apiHash || "")
      )
        throw new Error("Enter your Telegram API ID and API hash");
      await this.client?.disconnect();
      const session = saved?.apiId === Number(auth.apiId) ? saved.session : "";
      if (!interactive && !session) throw new Error("Sign in once to remember this account");
      this.client = this.createClient(
        new StringSession(session || ""),
        Number(auth.apiId),
        auth.apiHash,
        {
          connectionRetries: 3,
          requestRetries: 3,
          floodSleepThreshold: 0,
          deviceModel: "Season Shelf Desktop",
          appVersion,
        },
      );
      this.client.setLogLevel("none");
      if (!interactive) await this.client.connect();
      else await this.client.start({
        phoneNumber: async () =>
          auth.phone || this.ask("phone", "Your Telegram phone number"),
        phoneCode: async () =>
          this.ask("code", "Enter the code Telegram sent you"),
        password: async () =>
          this.ask(
            "password",
            "Enter your Telegram two-step verification password",
          ),
        emailAddress: async () =>
          this.ask("email", "Enter the email Telegram requests for sign-in"),
        emailVerification: async () => ({
          code: await this.ask(
            "code",
            "Enter your Telegram email verification code",
          ),
        }),
        onError: async (error) => {
          this.notify(
            "auth-error",
            String(error.errorMessage || error.message).slice(0, 150),
          );
          return true;
        },
      });
      if (!(await this.client.checkAuthorization()))
        throw new Error("Sign-in was not completed");
      this.saveCredentials({
        apiId: Number(auth.apiId),
        apiHash: auth.apiHash,
        session: this.client.session.save(),
      });
      this.connected = true;
      // Profile failure must not invalidate an otherwise authorised session.
      this.profile = null;
      try {
        const me = await this.client.getMe();
        this.profile = {
          name: [me.firstName, me.lastName].filter(Boolean).join(" ").slice(0, 160),
          username: String(me.username || "").slice(0, 64),
        };
      } catch { /* Account details can be refreshed on the next connection. */ }
      return { connected: true, profile: this.profile };
    } catch (error) {
      this.connected = false;
      this.profile = null;
      await this.client?.disconnect();
      throw error;
    } finally {
      this.connecting = false;
    }
  }
  requireClient() {
    if (!this.connected || !this.client)
      throw new Error("Connect your Telegram account first");
    return this.client;
  }
  input(peer) {
    return peer.type === "channel"
      ? new Api.InputPeerChannel({
          channelId: bigInt(peer.id),
          accessHash: bigInt(peer.accessHash),
        })
      : new Api.InputPeerChat({ chatId: bigInt(peer.id) });
  }
  async channels() {
    const result = [];
    for await (const dialog of this.requireClient().iterDialogs({
      limit: 300,
    })) {
      const e = dialog.entity;
      if (!["Channel", "Chat"].includes(e.className)) continue;
      result.push({
        id: String(e.id),
        title: dialog.title || "Untitled channel",
        peer: {
          id: String(e.id),
          type: e.className === "Channel" ? "channel" : "chat",
          accessHash: String(e.accessHash || 0),
        },
      });
    }
    return result;
  }
  async scan(channel, {minId=0,limit=10000} = {}) {
    const client = this.requireClient();
    const input = this.input(channel.peer);
    const entity = await client.getEntity(input);
    if (entity.noforwards)
      throw new Error("This channel restricts saving content");
    const items = [];
    let scanned = 0;
    let lastMessageId = minId;
    for await (const message of client.iterMessages(input, { limit, minId })) {
      scanned++;
      lastMessageId = Math.max(lastMessageId, Number(message.id));
      const doc = message.document;
      if (doc && !message.noforwards) {
        const filename =
          doc.attributes.find(
            (a) => a.className === "DocumentAttributeFilename",
          )?.fileName || "";
        const episode = parseEpisode({
          id: String(message.id),
          peer: channel.peer,
          filename,
          caption: message.message,
          size: Number(doc.size),
          documentId: String(doc.id),
        });
        if (episode) items.push(episode);
      }
      if (scanned % 100 === 0)
        this.notify("scan-progress", { scanned, found: items.length });
    }
    return {
      channel,
      items,
      scanned,
      lastMessageId,
      truncated: scanned >= limit,
      scannedAt: new Date().toISOString(),
    };
  }
  async *download(item, offset, signal) {
    const client = this.requireClient();
    const input = this.input(item.peer);
    const entity = await client.getEntity(input);
    if (entity.noforwards)
      throw new Error("This channel restricts saving content");
    const [message] = await client.getMessages(input, {
      ids: [Number(item.id)],
    });
    if (!message?.document || message.noforwards)
      throw new Error("Attachment is no longer available for saving");
    if (
      String(message.document.id) !== item.documentId ||
      Number(message.document.size) !== item.size
    )
      throw new Error("Source attachment changed; rescan the channel");
    if (signal.aborted) return;
    // Refill one bounded slot as each ordered chunk is consumed; no batch barrier.
    const block = 524288, controller = new AbortController();
    const combined = AbortSignal.any([signal,controller.signal]);
    const pending = new Map();
    const source=rangeSource(client,message.media);
    const read = async start => {
      await this.transferPolicy?.acquire(Math.min(block,item.size-start),combined);
      combined.throwIfAborted();
      if (Date.now() < (this.floodUntil || 0)) {
        const error=new Error("FLOOD_WAIT: Telegram requested a pause");
        error.seconds=Math.ceil((this.floodUntil-Date.now())/1000);throw error;
      }
      const data=await source.read(start,block,combined);
      if(data.length!==Math.min(block,item.size-start)) throw new Error("Incomplete range received from Telegram");
      return data;
    };
    let next=offset;
    const fill=()=>{while(pending.size<source.window && next<item.size) {const start=next;next+=block;pending.set(start,read(start).then(data=>({data}),error=>({error})));}};
    try {
      fill();
      for(let current=offset;current<item.size;current+=block) {
        const result=await pending.get(current);pending.delete(current);
        if(result.error) {
          if(/FLOOD/i.test(result.error.message || '') && result.error.seconds) this.floodUntil=Date.now()+result.error.seconds*1000;
          throw result.error;
        }
        combined.throwIfAborted();
        // Refill before the consumer writes to disk so network and staging I/O overlap.
        // Pending memory remains bounded by source.window plus the yielded chunk.
        fill();
        yield result.data;
      }
    } finally { controller.abort();await Promise.allSettled(pending.values()); }
  }

  async disconnect() {
    this.connected = false;
    this.profile = null;
    await this.client?.disconnect();
  }
}
