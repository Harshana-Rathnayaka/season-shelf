import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Api } from "teleproto";
import bigInt from "big-integer";
import { discoveryLinks, parseDiscoveryLink } from "../core/discovery.mjs";
import { resolveSearchSource, requireSearchGroup, isSearchReply } from "./search-source.mjs";

const searchBot = "MCF_SeriesBot";
const channelRecord = entity => ({id:String(entity.id),title:entity.title || "Series channel",peer:{id:String(entity.id),type:"channel",accessHash:String(entity.accessHash || 0)}});

export class Discovery {
  constructor(adapter, {wait = delay, now = Date.now, timeout = 30000} = {}) {
    Object.assign(this,{adapter,wait,now,timeout});
    this.choices = new Map();
    this.searchGroups = new Map();
  }
  cancel() { this.operation?.abort(); }
  async run(work) {
    if (this.operation) throw new Error("Wait for the current search to stop");
    const controller = new AbortController();
    this.operation = controller;
    try { return await work(this.adapter.requireClient(),controller.signal); }
    finally { this.operation = null; }
  }
  async bot(client, username) {
    if (username.toLowerCase() !== searchBot.toLowerCase()) throw new Error("This result points to another bot. Open it in Telegram for now.");
    const entity = await client.getEntity(username);
    if (entity.className !== "User" || !entity.bot) throw new Error("Search destination is not a Telegram bot. No message was sent.");
    return entity;
  }
  async prepareSearch(groupId) {
    return this.run(async(client,signal)=>{
      this.searchSource = null;
      let source;
      if (groupId) {
        source = this.searchGroups.get(groupId);
        if (!source || source.client !== client || source.expires < this.now()) throw new Error("Group choice expired. Find the search group again.");
      } else {
        this.searchGroups.clear();
        try { source = await resolveSearchSource(client,signal); }
        catch(error) {
          if (error.code !== "SEARCH_GROUP_UNRESOLVED") throw error;
          for await (const dialog of client.iterDialogs({limit:1000})) {
            signal.throwIfAborted();
            try { requireSearchGroup(dialog.entity); } catch { continue; }
            const id = randomUUID();
            this.searchGroups.set(id,{entity:dialog.entity,peer:await client.getInputEntity(dialog.entity),linked:false,client,expires:this.now()+300000});
          }
          signal.throwIfAborted();
          const groups = [...this.searchGroups].map(([id,value])=>({id,title:value.entity.title || "Group"}));
          const score = title => /movie\s*club\s*family|\bmcf\b/i.test(title) ? 0 : 1;
          groups.sort((a,b)=>score(a.title)-score(b.title) || a.title.localeCompare(b.title));
          return {groups};
        }
      }
      signal.throwIfAborted();
      const id = randomUUID();
      this.searchSource = {...source,id,client,expires:this.now()+300000};
      return {source:{id,title:source.entity.title || "MovieClubFamily group",linked:source.linked}};
    });
  }
  async search(query, sourceId) {
    if (typeof query !== "string" || !query.trim() || query.length > 120 || /[\r\n\u0000-\u001f]/.test(query) || query.trim().startsWith("/")) throw new Error("Enter a series name, up to 120 characters");
    return this.run(async (client,signal) => {
      const source = this.searchSource;
      if (!source || source.id !== sourceId || source.client !== client || source.expires < this.now())
        throw new Error("Find the MovieClubFamily search group before sending a query.");
      const group = requireSearchGroup(await client.getEntity(source.peer));
      if (String(group.id) !== String(source.entity.id)) throw new Error("Search group changed. Find the search group again.");
      const bot = await this.bot(client,searchBot);
      signal.throwIfAborted();
      this.choices.clear();
      this.searchSource = null;
      const sent = await client.sendMessage(source.peer,{message:query.trim(),parseMode:false,linkPreview:false});
      return this.responses(client,source.peer,sent.id,signal,{botId:bot.id,threaded:group.className === "Channel"});
    });
  }
  async openMessageLink(link) {
    const target = parseDiscoveryLink(link);
    if (target?.kind !== "private-message") throw new Error("Paste a private Telegram message link, such as https://t.me/c/123456/789");
    return this.run((client,signal)=>this.readLinkedMessage(client,target,signal));
  }
  async readLinkedMessage(client,target,signal) {
    signal.throwIfAborted();
    let peer;
    try { peer = await client.getInputEntity(new Api.PeerChannel({channelId:bigInt(target.channelId)})); }
    catch {
      // StringSession does not persist every channel access hash. Resolve from
      // accessible dialogs rather than inventing a hash or joining anything.
      for await (const dialog of client.iterDialogs({limit:1000})) {
        signal.throwIfAborted();
        if (dialog.entity?.className === "Channel" && String(dialog.entity.id) === target.channelId) {
          peer = await client.getInputEntity(dialog.entity);
          break;
        }
      }
    }
    signal.throwIfAborted();
    if (!peer) throw new Error("This private chat is not available in your account's recent dialogs. Open it in Telegram, then try again.");
    let messages;
    try { messages = await client.getMessages(peer,{ids:[target.messageId]}); }
    catch (error) {
      if (/CHANNEL_PRIVATE|CHANNEL_INVALID|MESSAGE_ID_INVALID/.test(error.errorMessage || error.message)) throw new Error("This message is unavailable or your account cannot access its private chat.");
      throw error;
    }
    signal.throwIfAborted();
    const message = messages.find(item=>item?.id === target.messageId && item.className !== "MessageEmpty");
    if (!message) throw new Error("The linked message was deleted or is not accessible to this account.");
    return this.presentMessages([message],peer);
  }
  presentMessages(messages, peer) {
    this.choices.clear();
    const seen = new Set();
    const gated = messages.some(message=>/\b(must join|join (?:the |our |these )?channels? (?:first|to)|subscribe|subscription required|verify membership)\b/i.test(message.message || ""));
    return {messages:messages.map(message=>({
      text:String(message.message || "").slice(0,4000),
      links:discoveryLinks(message).flatMap(link=>{
        const key = JSON.stringify(link.target) + (link.target.kind === "callback" ? message.id : link.target.kind === "unsupported" ? link.label : "");
        if (seen.has(key)) return [];
        seen.add(key);
        const id = randomUUID(); this.choices.set(id,{...link.target,...(link.target.kind === "callback" ? {peer,messageId:message.id} : {})});
        return [{id,label:link.label,kind:link.target.kind,automatic:link.automatic && !gated}];
      }),
    })),timedOut:messages.length === 0};
  }
  async responses(client, bot, afterId, signal, groupSearch = null) {
    const messages = new Map();
    const started = this.now();
    let changed = started, fingerprint = "";
    while (this.now() - started < this.timeout) {
      signal.throwIfAborted();
      const recent = await client.getMessages(bot,{limit:groupSearch ? 100 : 30,minId:afterId,...(groupSearch?.threaded ? {replyTo:afterId} : {})});
      signal.throwIfAborted();
      for (const message of recent) {
        if (groupSearch ? !isSearchReply(message,groupSearch.botId,afterId) :
            (message.id <= afterId || message.out || (message.senderId && String(message.senderId) !== String(bot.id)))) continue;
        messages.set(message.id,message);
      }
      const snapshot = [...messages.values()].sort((a,b)=>a.id-b.id);
      const next = JSON.stringify(snapshot.map(message=>[message.id,message.message,discoveryLinks(message)]));
      if (next !== fingerprint) { fingerprint = next; changed = this.now(); }
      if (snapshot.some(message=>discoveryLinks(message).length) && this.now() - changed >= 5000) break;
      await this.wait(1500,undefined,{signal});
    }
    signal.throwIfAborted();
    // Thread reads may omit or lag inline keyboard edits. Fetch the actual
    // accepted messages again before presenting their current buttons.
    if (messages.size) {
      const hydrated = await client.getMessages(bot,{ids:[...messages.keys()]});
      signal.throwIfAborted();
      for (const message of hydrated) if (message && messages.has(message.id) && message.className !== "MessageEmpty") messages.set(message.id,message);
    }
    return this.presentMessages([...messages.values()].sort((a,b)=>a.id-b.id),bot);
  }
  async follow(id) {
    const target = this.choices.get(id);
    if (!target) throw new Error("Search result expired. Search again.");
    return this.run(async(client,signal)=>{
      if (target.kind === "unsupported") throw new Error("This button needs Telegram. Its type is not supported yet.");
      if (target.kind === "callback") {
        if (!target.peer) throw new Error("This button has no message context. Search again.");
        const current = await client.getMessages(target.peer,{ids:[target.messageId]});
        signal.throwIfAborted();
        const stillPresent = current.some(message=>message.id === target.messageId && discoveryLinks(message).some(link=>link.target.kind === "callback" && JSON.stringify(link.target.data) === JSON.stringify(target.data)));
        if (!stillPresent) throw new Error("This bot button changed. Search again for current results.");
        const answer = await client.invoke(new Api.messages.GetBotCallbackAnswer({peer:target.peer,msgId:target.messageId,data:Buffer.from(target.data)}));
        signal.throwIfAborted();
        if (answer.url) {
          const next = parseDiscoveryLink(answer.url);
          if (!next) throw new Error("The bot returned an unsupported link. Open this result in Telegram.");
          return this.presentMessages([{id:target.messageId,message:answer.message || "",replyMarkup:{rows:[{buttons:[{text:"Continue to series",url:answer.url}]}]}}],target.peer);
        }
        let edited = current;
        const before = JSON.stringify(current.map(message=>[message.message,discoveryLinks(message)]));
        for (let attempt=0; attempt<6; attempt++) {
          edited = await client.getMessages(target.peer,{ids:[target.messageId]});
          signal.throwIfAborted();
          if (answer.alert || JSON.stringify(edited.map(message=>[message.message,discoveryLinks(message)])) !== before) break;
          if (attempt<5) await this.wait(1000,undefined,{signal});
        }
        const result = this.presentMessages(edited.filter(message=>message?.id === target.messageId),target.peer);
        if (answer.message) result.notice = answer.message;
        // Pagination and callbacks without a returned URL require selection;
        // do not automatically press the same keyboard repeatedly.
        result.messages.forEach(message=>message.links.forEach(link=>{ if (link.kind === "callback" || answer.alert) link.automatic=false; }));
        return result;
      }
      if (target.kind === "private-message") return this.readLinkedMessage(client,target,signal);
      if (target.kind === "bot-start") {
        const bot = await this.bot(client,target.username);
        const previous = await client.getMessages(bot,{limit:1});
        signal.throwIfAborted();
        if (target.start) await client.invoke(new Api.messages.StartBot({bot:await client.getInputEntity(bot),peer:await client.getInputEntity(bot),randomId:bigInt(randomBytes(7).toString("hex"),16),startParam:target.start}));
        else await client.sendMessage(bot,{message:"/start",parseMode:false,linkPreview:false});
        return this.responses(client,bot,previous[0]?.id || 0,signal);
      }
      let entity, title;
      if (target.kind === "invite") {
        const invitation = await client.invoke(new Api.messages.CheckChatInvite({hash:target.invite}));
        entity = invitation.chat;
        title = invitation.title || entity?.title;
        if (!entity && (!invitation.channel || invitation.megagroup)) throw new Error("This invite is for a group. Open it in Telegram for now.");
      } else {
        entity = await client.getEntity(target.username);
        if (entity.className === "User" && entity.bot && target.username.toLowerCase() === searchBot.toLowerCase()) {
          const startId = randomUUID();
          this.choices.set(startId,{kind:"bot-start",username:target.username,start:""});
          return {messages:[{text:"This bot link has no series-specific start parameter.",links:[{id:startId,label:`Start @${target.username}`,kind:"bot-start",automatic:true}]}]};
        }
        title = entity.title;
      }
      signal.throwIfAborted();
      if (entity && (entity.className !== "Channel" || !entity.broadcast)) throw new Error("This link is not a broadcast series channel. Open it in Telegram for now.");
      return {channel:{id,title:title || "Linked channel"}};
    });
  }
  async join(id) {
    const target = this.choices.get(id);
    if (!target || !["invite","public-peer"].includes(target.kind)) throw new Error("Channel choice expired");
    return this.run(async(client,signal)=>{
      let entity;
      if (target.kind === "invite") {
        const preview = await client.invoke(new Api.messages.CheckChatInvite({hash:target.invite}));
        entity = preview.chat;
        if (!entity && (!preview.channel || preview.megagroup)) throw new Error("This is not a broadcast channel invite");
        if (entity && (entity.className !== "Channel" || !entity.broadcast)) throw new Error("This is not a broadcast channel");
        signal.throwIfAborted();
        if (!entity || entity.left) {
          const updates = await client.invoke(new Api.messages.ImportChatInvite({hash:target.invite}));
          entity = updates.chats?.find(chat=>chat.className === "Channel" && chat.broadcast);
          // A successful import can return updates without a full chat entity.
          // Recheck this exact invite rather than guessing from recent dialogs.
          if (!entity) entity = (await client.invoke(new Api.messages.CheckChatInvite({hash:target.invite}))).chat;
        }
      } else {
        entity = await client.getEntity(target.username);
        if (entity.className !== "Channel" || !entity.broadcast) throw new Error("This is not a broadcast channel");
        signal.throwIfAborted();
        if (entity.left) await client.invoke(new Api.channels.JoinChannel({channel:await client.getInputEntity(entity)}));
      }
      signal.throwIfAborted();
      if (!entity) throw new Error("Join request submitted. Once approved, refresh your channels.");
      if (entity.className !== "Channel" || !entity.broadcast) throw new Error("Channel membership is not ready yet. Refresh your channels after Telegram approves the join.");
      return channelRecord(entity);
    });
  }
}
