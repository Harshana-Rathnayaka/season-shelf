import { createRequire } from "node:module";
const { version: appVersion } = createRequire(import.meta.url)("../../package.json");
import { rangeSource } from "./range-source.mjs";
import { episodeFromMessage } from "./telegram-media.mjs";
import { isBotReply, isMcfBot } from "./mcf.mjs";
import { deliveryCatalogue } from "./bot-delivery.mjs";
import { TelegramClient, Api } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import { UpdateConnectionState } from "teleproto/network/UpdateConnectionState.js";
import bigInt from "big-integer";
import { parseEpisode } from "../core/catalog.mjs";

export class TelegramAdapter {
  constructor({ loadCredentials, saveCredentials, clearCredentials, ask, notify, createClient }) {
    Object.assign(this, { loadCredentials, saveCredentials, clearCredentials, ask, notify });
    this.client = null;
    this.connected = false;
    this.createClient = createClient || ((...args) => new TelegramClient(...args));
  }
  async connect(credentials, { interactive = true } = {}) {
    if (this.connecting || this.loggingOut) throw new Error("An account operation is already in progress");
    this.connecting = true;
    try {
      // Supplying details always means a fresh sign-in. An API ID identifies
      // an application, not a Telegram user, and must never select a session.
      const saved = credentials ? null : this.loadCredentials();
      const auth = credentials || saved;
      if (
        !auth ||
        !Number.isInteger(Number(auth.apiId)) ||
        Number(auth.apiId) <= 0 ||
        !/^[a-f0-9]{32}$/i.test(auth.apiHash || "")
      )
        throw new Error("Enter your Telegram API ID and API hash");
      if (credentials) this.clearCredentials?.();
      this.authorized = false;
      this.connected = false;
      await this.client?.disconnect();
      const session = saved?.session || "";
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
      const client = this.client;
      client.addEventHandler?.(update => {
        if (this.client !== client || !this.authorized || !(update instanceof UpdateConnectionState)) return;
        this.connectionState(update.state === UpdateConnectionState.connected);
      });
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
      const me = await this.client.getMe();
      if (!/^\d+$/.test(String(me?.id || '')))
        throw new Error('Telegram account identity could not be verified. Please reconnect.');
      this.accountId = String(me.id);
      this.saveCredentials({
        apiId: Number(auth.apiId),
        apiHash: auth.apiHash,
        session: this.client.session.save(),
      });
      this.authorized = true;
      this.needsReconnect = false;
      this.connected = true;
      this.profile = {
        name: [me.firstName, me.lastName].filter(Boolean).join(" ").slice(0, 160),
        username: String(me.username || "").slice(0, 64),
      };
      return { connected: true, profile: this.profile };
    } catch (error) {
      this.authorized = false;
      this.connected = false;
      this.profile = null;
      this.accountId = null;
      const client = this.client;
      this.client = null;
      await client?.disconnect();
      throw error;
    } finally {
      this.connecting = false;
    }
  }
  requireClient() {
    if ((!this.connected && !this.authorized) || !this.client)
      throw new Error("Connect your Telegram account first");
    return this.client;
  }
  connectionState(connected, restoringSession = false) {
    this.connected = connected;
    this.notify?.("connection", { connected, restoringSession, connectionError: "", profile: this.profile });
  }
  async downloadClient() {
    const client = this.requireClient();
    if (this.reconnecting) return this.reconnecting;
    if (client.connected !== false && !this.needsReconnect) return client;
    this.connectionState(false, true);
    // Concurrent downloads share one reconnect, retaining the authorised session.
    this.reconnecting = (async () => {
      try {
        await client.connect();
        if (this.client !== client || (!this.authorized && !this.connected))
          throw new Error("Connect your Telegram account first");
        this.needsReconnect = false;
        this.connectionState(true);
        return client;
      } catch (error) {
        this.connectionState(false);
        throw new Error(`Telegram network reconnect failed: ${error.message || error}`, { cause: error });
      } finally { this.reconnecting = null; }
    })();
    return this.reconnecting;
  }
  input(peer) {
    if (peer.type === "user") return new Api.InputPeerUser({userId:bigInt(peer.id),accessHash:bigInt(peer.accessHash)});
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
      const bot=e.className==='User' && e.bot && isMcfBot(e.username);
      if (!["Channel", "Chat"].includes(e.className) && !bot) continue;
      result.push({
        id: bot ? `user:${e.id}` : String(e.id),
        title: dialog.title || "Untitled channel",
        ...(bot ? {source:'bot'} : {}),
        peer: {
          id: String(e.id),
          type: bot ? "user" : e.className === "Channel" ? "channel" : "chat",
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
    if(channel.peer.type==='user')return this.scanBotInbox(channel,entity,{minId,limit:Math.min(limit,1000)});
    if (entity.noforwards)
      throw new Error("This channel restricts saving content");
    const items = [];
    let scanned = 0;
    let lastMessageId = minId;
    for await (const message of this.history(input, { limit, minId })) {
      scanned++;
      lastMessageId = Math.max(lastMessageId, Number(message.id));
      const mediaDocument = message.media instanceof Api.MessageMediaDocument
        ? message.media.document
        : message.media instanceof Api.MessageMediaWebPage ? message.media.webpage?.document : null;
      const doc = message.document || (mediaDocument instanceof Api.Document ? mediaDocument : null);
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
  async scanBotInbox(channel,bot,{minId=0,limit=1000}={}) {
    if(bot.className!=='User' || !bot.bot || !isMcfBot(bot.username) || String(bot.id)!==channel.peer.id)
      throw new Error('This chat is not a supported MCF bot. Refresh your chat list.');
    if(bot.noforwards)throw new Error('This bot restricts saving content');
    const messages=[];let scanned=0;
    for await(const message of this.history(this.input(channel.peer),{minId,limit})) {
      scanned++;
      if(isBotReply(message,bot.id))messages.push(message);
      if(scanned%100===0)this.notify?.('scan-progress',{scanned,found:0});
    }
    const catalogue=deliveryCatalogue(messages,bot,{}, {truncated:scanned>=limit});
    if(catalogue)return {...catalogue,scanned};
    return {channel,items:[],source:'bot',scanned,scannedAt:new Date().toISOString(),
      delivery:{bot:bot.username,afterId:minId,expected:null,received:0,complete:false,selection:{}},
      sourceWarning:'No downloadable episode files remain in this bot chat. Request a season through MCF search, then check the delivery again.'};
  }
  async refreshDelivery(catalogue) {
    if (catalogue?.source !== 'bot' || catalogue.channel?.peer?.type !== 'user') throw new Error('Choose a bot delivery first');
    const client=this.requireClient(), peer=catalogue.channel.peer;
    const ids=catalogue.items.map(item=>Number(item.id));
    const messages=ids.length ? await client.getMessages(this.input(peer),{ids}) : [];
    const originals=new Map(catalogue.items.map(item=>[item.id,item]));
    const items=messages.filter(message=>isBotReply(message,peer.id)).map(message=>episodeFromMessage(message,peer))
      .filter(item=>item && originals.get(item.id)?.documentId===item.documentId && originals.get(item.id)?.size===item.size)
      .map(item=>({...item,...(originals.get(item.id).reason ? {reason:originals.get(item.id).reason} : {}),collectionId:catalogue.channel.id}));
    const episodes=new Set();
    for(const item of items.filter(item=>!item.reason))
      for(let n=item.episode;n<=item.episodeEnd;n++)episodes.add(`${item.season}:${n}`);
    return {...catalogue,items,scanned:messages.length,scannedAt:new Date().toISOString(),
      ...(catalogue.delivery ? {delivery:{...catalogue.delivery,received:episodes.size,complete:catalogue.delivery.complete && items.length===catalogue.items.length}} : {}),
      sourceWarning:items.length<catalogue.items.length ? 'Some bot messages were deleted or are unavailable. Request the season again for missing files.' : catalogue.sourceWarning};
  }
  async *history(input, { limit, minId }) {
    const client = this.requireClient();
    let offsetId = 0;
    let remaining = limit;
    while (remaining > 0) {
      // Teleproto's iterator ends the whole scan on an out-of-range message,
      // including Telegram's id=0 empty placeholders. Page explicitly so a
      // placeholder cannot hide the real messages that follow it.
      const page = await client.invoke(new Api.messages.GetHistory({
        peer: input, offsetId, offsetDate: 0, addOffset: 0,
        limit: Math.min(100, remaining), maxId: 0, minId: 0, hash: bigInt.zero,
      }));
      if (!Array.isArray(page.messages))
        throw new Error("Telegram did not return channel history. Please rescan.");
      if (!page.messages.length) return;
      const messages = page.messages.filter(message =>
        Number.isSafeInteger(message.id) && message.id > 0 &&
        (!offsetId || message.id < offsetId)
      ).sort((a, b) => b.id - a.id);
      if (!messages.length)
        throw new Error("Telegram returned unreadable channel history. Please rescan.");
      for (const message of messages) {
        if (message.id <= minId) return;
        yield message;
        if (--remaining === 0) return;
      }
      offsetId = messages.at(-1).id;
    }
  }
  async *download(item, offset, signal) {
    signal.throwIfAborted();
    const client = await this.downloadClient();
    signal.throwIfAborted();
    try {
      const input = this.input(item.peer);
      const entity = await client.getEntity(input);
      if (entity.noforwards)
        throw new Error("This channel restricts saving content");
      const [message] = await client.getMessages(input, {
        ids: [Number(item.id)],
      });
      if (!message?.document || message.noforwards)
        throw new Error(item.peer.type === 'user' ? "Bot attachment expired, was deleted, or cannot be saved. Request the season again." : "Attachment is no longer available for saving");
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
    } catch (error) {
      if (!signal.aborted && /disconnected|reconnect/i.test(error.message || "")) {
        this.needsReconnect = true;
        this.connectionState(false);
      }
      throw error;
    }
  }

  async disconnect() {
    const client = this.client;
    this.client = null;
    this.authorized = false;
    this.needsReconnect = false;
    this.connected = false;
    this.profile = null;
    this.accountId = null;
    await client?.disconnect();
  }

  async logout() {
    if (this.connecting || this.loggingOut) throw new Error('An account operation is already in progress');
    // Forget disk credentials before network I/O, even when offline or revoked.
    this.clearCredentials?.();
    this.loggingOut = true;
    const client = this.client;
    const authorized = this.authorized;
    this.client = null;
    this.authorized = this.connected = false;
    this.profile = this.accountId = null;
    this.needsReconnect = false;
    let revoked = false;
    try {
      if (client && authorized) revoked = await client.logOut();
    } catch { /* Local logout must succeed when Telegram is unreachable. */ }
    finally {
      try { await client?.disconnect(); } catch { /* Already signed out locally. */ }
      try { await client?.session?.delete?.(); } catch { /* Detached client cannot be reused. */ }
      this.loggingOut = false;
    }
    return { revoked };
  }
}
