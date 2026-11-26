import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Api } from "teleproto";
import bigInt from "big-integer";
import { discoveryLinks, parseDiscoveryLink } from "../core/discovery.mjs";
import { resolveSearchSource, requireSearchGroup, isSearchReply } from "./search-source.mjs";

import { mcfBots, isMcfBot, senderId, isBotReply, updateSelection, botActionHint, isExpiredSearchNotice } from "./mcf.mjs";
import { deliveryCatalogue } from "./bot-delivery.mjs";
import { messageText } from "../core/telegram-content.mjs";

const messageFingerprint = message => JSON.stringify([messageText(message),discoveryLinks(message)]);
const channelRecord = entity => ({id:String(entity.id),title:entity.title || "Series channel",peer:{id:String(entity.id),type:"channel",accessHash:String(entity.accessHash || 0)}});
const savedPeer = peer => {
  const type=/Channel$/.test(peer?.className) ? 'channel' : /Chat$/.test(peer?.className) ? 'chat' : /User$/.test(peer?.className) ? 'user' : null;
  const id=peer?.channelId ?? peer?.chatId ?? peer?.userId ?? peer?.id;
  return type && id!=null ? {type,id:String(id),accessHash:String(peer.accessHash || 0)} : null;
};
const restoredPeer = peer => peer.type==='channel' ? new Api.InputPeerChannel({channelId:bigInt(peer.id),accessHash:bigInt(peer.accessHash)})
  : peer.type==='chat' ? new Api.InputPeerChat({chatId:bigInt(peer.id)})
    : new Api.InputPeerUser({userId:bigInt(peer.id),accessHash:bigInt(peer.accessHash)});

export class Discovery {
  constructor(adapter, {store, wait = delay, now = Date.now, timeout = 15000, searchTimeout = 45000, deliveryTimeout = 120000} = {}) {
    Object.assign(this,{adapter,store,wait,now,timeout,searchTimeout,deliveryTimeout});
    this.choices = new Map();
    this.searchGroups = new Map();
  }
  cancel() { this.operation?.abort(); }
  reset() { this.cancel(); this.choices.clear(); this.searchGroups.clear(); this.helperIds=null; this.searchSource=null; this.delivery=null; this.selection={}; this.manualFlow=false; this.resumeTarget=null; this.resumeSearch=null; this.seriesShortcut=null; this.recentContext=null; }
  recentSeries() {
    this.adapter.requireClient();
    return this.store?.get('recentSeries',[]).map(({id,title,season,resolution})=>({id,title,season,resolution})) || [];
  }
  rememberSeries(catalogue) {
    if(!this.store || !catalogue?.items.length) return;
    const title=catalogue.channel.title;
    const id=title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const previous=this.store.get('recentSeries',[]);
    const context=(this.recentContext?.id===id ? this.recentContext : previous.find(entry=>entry.id===id)) || {};
    const entry={...context,id,title,query:this.resumeSearch?.query || context.query || title,
      searchPeer:savedPeer(this.resumeSearch?.source?.peer) || context.searchPeer,
      season:catalogue.delivery.selection?.season,resolution:catalogue.delivery.selection?.resolution,
      shortcut:this.seriesShortcut || context.shortcut,updatedAt:this.now()};
    this.store.set('recentSeries',[entry,...previous.filter(item=>item.id!==id)].slice(0,12));
  }
  async resumeSeries(id) {
    if(this.operation) throw new Error('Wait for the current search to stop');
    const entry=this.store?.get('recentSeries',[]).find(item=>item.id===id);
    if(!entry) throw new Error('This recent series is no longer available. Choose another series.');
    this.recentContext=entry;this.seriesShortcut=entry.shortcut;
    this.selection={...entry.shortcut?.selection,title:entry.title,season:entry.season};
    delete this.selection.resolution;delete this.selection.expected;
    this.delivery=null;this.resumeSearch=null;this.resumeTarget=null;this.searchSource=null;this.choices.clear();
    const shortcut=entry.shortcut;
    if(shortcut) {
      try {
        const result=await this.run(async(client,signal)=>{
          // Reopen the message itself, exactly like pasting its Telegram link.
          // Bot navigation edits its text and keyboard in place; those edits
          // must not invalidate a saved chat/message reference.
          if(shortcut.peer.type==='channel') return this.readLinkedMessage(client,
            {channelId:shortcut.peer.id,messageId:shortcut.messageId},signal,{expectedSender:shortcut.sender,restoreSelection:true});
          const peer=shortcut.bot ? await this.bot(client,shortcut.bot) : restoredPeer(shortcut.peer);
          if(shortcut.bot && String(peer.id)!==shortcut.peer.id) throw new Error('Saved bot identity changed. Request a fresh search.');
          return this.readMenuMessage(client,peer,shortcut.messageId,signal,{expectedSender:shortcut.sender,restoreSelection:true});
        });
        if(result && !result.expired) return result;
      } catch(error) {
        if(error.name==='AbortError') throw error;
        if(!/MESSAGE_ID_INVALID|MSG_ID_INVALID|USERNAME_INVALID|USERNAME_NOT_OCCUPIED|CHANNEL_PRIVATE|CHANNEL_INVALID|PEER_ID_INVALID|deleted|expired|unavailable|no longer valid|Saved bot identity changed|sender changed|not available in your account|not accessible/i.test(error.errorMessage || error.message || '')) throw error;
      }
    }
    return this.recentSearch(entry);
  }
  async recentSearch(entry=this.recentContext) {
    if(!entry) throw new Error('Choose a recent series first.');
    let groupId;
    if(entry.searchPeer) {
      groupId=randomUUID();
      const client=this.adapter.requireClient(), peer=restoredPeer(entry.searchPeer);
      this.searchGroups.set(groupId,{entity:{id:entry.searchPeer.id},peer,linked:false,client,expires:this.now()+300000});
    }
    const result=await this.prepareSearch(groupId);
    return {...result,query:entry.query || entry.title,notice:'The saved bot menu is no longer available. Post a fresh search to choose another season.'};
  }
  async run(work) {
    if (this.operation) throw new Error("Wait for the current search to stop");
    const controller = new AbortController();
    this.operation = controller;
    try { return await work(this.adapter.requireClient(),controller.signal); }
    finally { this.operation = null; }
  }
  async bot(client, username) {
    if (!isMcfBot(username)) throw new Error("This result points to another bot. Open it in Telegram for now.");
    const entity = await client.getEntity(username);
    if (entity.className !== "User" || !entity.bot) throw new Error("Search destination is not a Telegram bot. No message was sent.");
    entity.username ||= username;
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
      const resolved = await Promise.allSettled(mcfBots.map(name => this.bot(client,name)));
      const bots = resolved.filter(value => value.status === 'fulfilled').map(value => value.value);
      if (!bots.length) throw new Error("The MCF bots could not be verified. Try again later.");
      this.helperIds=new Set(bots.filter(bot=>/^MCFHelper/i.test(bot.username)).map(bot=>String(bot.id)));
      this.manualFlow=false;
      signal.throwIfAborted();
      this.choices.clear();
      this.selection = {title:query.trim()};
      this.seriesShortcut=null;this.recentContext=null;
      this.delivery = null;
      this.resumeTarget = null;
      this.resumeSearch = {query:query.trim(),source};
      this.searchSource = null;
      const sent = await client.sendMessage(source.peer,{message:query.trim(),parseMode:false,linkPreview:false});
      return this.responses(client,source.peer,sent.id,signal,{botIds:bots.map(bot=>String(bot.id))});
    });
  }
  async openMessageLink(link) {
    const target = parseDiscoveryLink(link);
    if (target?.kind !== "private-message") throw new Error("Paste a private Telegram message link, such as https://t.me/c/123456/789");
    this.seriesShortcut=null;this.recentContext=null;this.selection={};this.resumeSearch=null;
    return this.run((client,signal)=>this.readLinkedMessage(client,target,signal));
  }
  async readLinkedMessage(client,target,signal,options={}) {
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
    return this.readMenuMessage(client,peer,target.messageId,signal,options);
  }
  async readMenuMessage(client,peer,messageId,signal,{expectedSender,restoreSelection=false}={}) {
    let messages;
    try { messages = await client.getMessages(peer,{ids:[messageId]}); }
    catch (error) {
      if (/CHANNEL_PRIVATE|CHANNEL_INVALID|MESSAGE_ID_INVALID/.test(error.errorMessage || error.message)) throw new Error("This message is unavailable or your account cannot access its private chat.");
      throw error;
    }
    signal.throwIfAborted();
    const message = messages.find(item=>item?.id === messageId && item.className !== "MessageEmpty");
    if (!message) throw new Error("The linked message was deleted or is not accessible to this account.");
    if(expectedSender!==undefined && senderId(message)!==expectedSender) throw new Error('The saved message sender changed. Choose a fresh result.');
    if(!messageText(message).trim() && !discoveryLinks(message).length)
      throw new Error('Telegram returned this message without readable text or supported buttons. Its content format may be unsupported; open it in Telegram.');
    if(restoreSelection) {
      const season=/\bSeason\s*(\d{1,2})\b/i.exec(messageText(message));
      if(season) this.selection=updateSelection(this.selection,`Season ${season[1]}`);
    }
    return this.presentMessages([message],peer,{manual:true,queryId:message.replyTo?.replyToMsgId,botIds:senderId(message)?[senderId(message)]:undefined});
  }
  expiredResult(notice) {
    this.choices.clear();this.resumeTarget=null;this.resumeSearch=null;this.searchSource=null;
    this.selection={};this.delivery=null;
    return {expired:true,notice:String(notice || '').slice(0,4000),messages:[]};
  }
  presentMessages(messages, peer, context = {}) {
    const expired=messages.find(message=>isExpiredSearchNotice(messageText(message)));
    if(expired)return this.expiredResult(messageText(expired));
    const menu=!context.synthetic && messages.find(message=>discoveryLinks(message).some(link=>['callback','bot-start','private-message'].includes(link.target.kind)));
    if(menu && savedPeer(peer)) {
      this.seriesShortcut={peer:savedPeer(peer),...(isMcfBot(peer.username) ? {bot:peer.username} : {}),sender:senderId(menu),messageId:menu.id,selection:{...this.selection}};
      // Keep an existing recent entry's place current even when a Back button
      // creates a new message and the user closes before requesting files.
      if(this.recentContext && this.store) {
        this.recentContext={...this.recentContext,shortcut:this.seriesShortcut};
        this.store.set('recentSeries',this.store.get('recentSeries',[]).map(entry=>entry.id===this.recentContext.id?{...entry,shortcut:this.seriesShortcut}:entry));
      }
    }
    this.choices.clear();
    const manual=context.manual || this.manualFlow || messages.some(message=>this.helperIds?.has(senderId(message)));
    if(manual)this.manualFlow=true;
    const seen = new Set();
    const gated = messages.some(message=>/\b(must join|join (?:the |our |these )?channels? (?:first|to)|subscribe|subscription required|verify membership)\b/i.test(messageText(message)) || discoveryLinks(message).some(link=>/\b(verify|joined|subscribe|subscription)\b/i.test(link.label)));
    return {subscriptionRequired:gated,messages:messages.map(message=>({
      text:messageText(message).slice(0,4000),
      links:discoveryLinks(message).flatMap(link=>{
        const key = JSON.stringify(link.target) + (link.target.kind === "callback" ? message.id : link.target.kind === "unsupported" ? link.label : "");
        if (seen.has(key)) return [];
        seen.add(key);
        const id = randomUUID(); this.choices.set(id,{...link.target,label:link.label,selection:{...this.selection},...context,manual,...(link.target.kind === "callback" ? {peer,messageId:message.id,sender:senderId(message),fingerprint:messageFingerprint(message)} : {})});
        const handoff=link.target.kind==='bot-start' && link.label==='Continue to series';
        return [{id,label:link.label,hint:botActionHint(link.label),kind:link.target.kind,automatic:link.automatic && !gated && link.target.kind !== "callback" && (!manual || handoff)}];
      }),
    })),timedOut:messages.length === 0};
  }
  async readRecent(client, peer, afterId, signal) {
    if(this.adapter.history) {
      const messages=[];let scanned=0;
      for await(const message of this.adapter.history(peer,{minId:afterId,limit:1000})) {
        signal.throwIfAborted();scanned++;
        if(!message.out)messages.push(message);
      }
      signal.throwIfAborted();
      return {messages,truncated:scanned>=1000};
    }
    const messages = new Map(); let offsetId=0, truncated=false;
    for(let page=0;page<10;page++) {
      const batch=await client.getMessages(peer,{limit:100,minId:afterId,...(offsetId?{offsetId}:{})});
      signal.throwIfAborted();
      for(const message of batch) if(message.id>afterId && !message.out) messages.set(message.id,message);
      if(batch.length<100) break;
      const next=Math.min(...batch.map(message=>message.id).filter(id=>id>afterId));
      if(!Number.isFinite(next) || (offsetId && next>=offsetId)) {truncated=true;break;}
      offsetId=next; if(page===9)truncated=true;
    }
    return {messages:[...messages.values()],truncated};
  }
  async responses(client, bot, afterId, signal, groupSearch = null) {
    const messages = new Map(); const started = this.now();
    let changed=started, fingerprint='', hasFiles=false, truncated=false, complete=false;
    const privateBot=bot.className==='User' && bot.bot;
    let duration=groupSearch ? this.searchTimeout : privateBot && this.selection?.resolution ? this.deliveryTimeout : this.timeout;
    while(this.now()-started<duration) {
      signal.throwIfAborted();
      // GetReplies can return stripped thread messages. Read actual group history
      // and correlate sender + reply IDs locally instead of treating it as a thread.
      const recent = await this.readRecent(client,bot,afterId,signal);
      signal.throwIfAborted(); truncated ||= recent.truncated;
      for(const message of recent.messages) {
        if (groupSearch?.excludeIds?.includes(message.id)) continue;
        if(groupSearch ? !(isSearchReply(message,groupSearch.botIds || groupSearch.botId,afterId) ||
            (groupSearch.callbackId && isSearchReply(message,groupSearch.botIds,groupSearch.callbackId)))
          : (message.id<=afterId || !isBotReply(message,bot.id)))continue;
        messages.set(message.id,message);
      }
      const snapshot=[...messages.values()].sort((a,b)=>a.id-b.id);
      const expired=snapshot.find(message=>isExpiredSearchNotice(messageText(message)));
      if(expired)return this.expiredResult(messageText(expired));
      const next=JSON.stringify(snapshot.map(message=>[message.id,messageFingerprint(message),String(message.document?.id || message.media?.document?.id || '')]));
      if(next!==fingerprint){fingerprint=next;changed=this.now();}
      const catalogue=privateBot ? deliveryCatalogue(snapshot,bot,this.selection) : null;
      if(catalogue) {
        hasFiles=true;duration=this.deliveryTimeout;
        const enough=!this.selection?.expected || catalogue.delivery.received>=this.selection.expected;
        if(enough && this.now()-changed>=8000){complete=!!this.selection?.expected;break;}
      } else if(!this.selection?.resolution && snapshot.some(message=>discoveryLinks(message).length) && this.now()-changed>=5000)break;
      const remaining=duration-(this.now()-started);
      if(remaining>0)await this.wait(Math.min(1500,remaining),undefined,{signal});
    }
    signal.throwIfAborted();
    if(hasFiles) {
      // Fetch again: deleted messages must not survive from an earlier poll.
      const fresh=await this.readRecent(client,bot,afterId,signal);
      const accepted=fresh.messages.filter(message=>isBotReply(message,bot.id));
      const catalogue=deliveryCatalogue(accepted,bot,this.selection,{complete,truncated:truncated || fresh.truncated,now:this.now()});
      if(!catalogue)throw new Error('The delivered files were deleted or are unavailable. Request the season again.');
      catalogue.delivery.afterId=afterId;
      this.delivery={client,bot,afterId,selection:{...this.selection}};
      this.rememberSeries(catalogue);
      this.choices.clear();
      return {catalogue};
    }
    if(messages.size) {
      const hydrated=await client.getMessages(bot,{ids:[...messages.keys()]});signal.throwIfAborted();
      for(const message of hydrated)if(message && messages.has(message.id) && message.className!=='MessageEmpty' &&
        (messageText(message).trim() || discoveryLinks(message).length))messages.set(message.id,message);
    }
    const visible=[...messages.values()].filter(message=>messageText(message).trim() || discoveryLinks(message).length).sort((a,b)=>a.id-b.id);
    const result=this.presentMessages(visible,bot,groupSearch?{queryId:afterId,botIds:groupSearch.botIds || [String(groupSearch.botId)]}:{});
    if(!visible.length)result.notice=groupSearch
      ? 'No readable MCF reply to your search arrived within 45 seconds. If Telegram shows the result, copy its message link and use Read linked message. You can also open an existing helper chat from Change series.'
      : 'No readable bot menu or episode files arrived. Try again, or open the helper chat from Change series to read existing files.';
    return result;
  }
  async collectDelivery(savedCatalogue = null) {
    return this.run(async(client,signal)=>{
      if (savedCatalogue?.source === 'bot' && savedCatalogue.delivery) {
        const bot=await this.bot(client,savedCatalogue.delivery.bot);
        signal.throwIfAborted();
        if(String(bot.id)!==savedCatalogue.channel.peer?.id)throw new Error('Delivery bot identity changed. Request the season again.');
        this.delivery={client,bot,afterId:savedCatalogue.delivery.afterId,selection:savedCatalogue.delivery.selection};
      }
      const delivery=this.delivery;
      if(!delivery || delivery.client!==client)throw new Error('Choose a season and quality in the MCF bot first.');
      if(this.selection?.title!==delivery.selection?.title) {
        this.seriesShortcut=null;this.recentContext=null;this.resumeSearch=null;
      }
      this.selection={...delivery.selection};
      return this.responses(client,delivery.bot,delivery.afterId,signal);
    });
  }
  async follow(id) {
    const target = this.choices.get(id);
    if (!target) throw new Error("Search result expired. Search again.");
    return this.run(async(client,signal)=>{
      this.selection=updateSelection(target.selection || this.selection,target.label);
      if(target.manual)this.manualFlow=true;
      if (["bot-start","callback"].includes(target.kind)) this.resumeTarget = {...target,selection:{...this.selection}};
      if (target.kind === "unsupported") throw new Error("This button needs Telegram. Its type is not supported yet.");
      if (target.kind === "callback") {
        if (!target.peer) throw new Error("This button has no message context. Search again.");
        const current = await client.getMessages(target.peer,{ids:[target.messageId]});
        signal.throwIfAborted();
        const stillPresent = current.some(message=>message.id === target.messageId && (!target.fingerprint || messageFingerprint(message)===target.fingerprint) && (!target.sender || senderId(message)===target.sender) && discoveryLinks(message).some(link=>link.target.kind === "callback" && JSON.stringify(link.target.data) === JSON.stringify(target.data)));
        if (!stillPresent) {
          if(this.recentContext) return this.readMenuMessage(client,target.peer,target.messageId,signal,{expectedSender:target.sender,restoreSelection:true});
          throw new Error("This bot button changed. Search again for current results.");
        }
        const privateBot=target.peer.className==='User' && target.peer.bot;
        const beforeDelivery=privateBot ? await client.getMessages(target.peer,{limit:1}) : [];
        signal.throwIfAborted();
        let answer;
        try {answer = await client.invoke(new Api.messages.GetBotCallbackAnswer({peer:target.peer,msgId:target.messageId,data:Buffer.from(target.data)}));}
        catch(error) {
          signal.throwIfAborted();
          if(/^(?:QUERY_ID_INVALID|QUERY_TOO_OLD|BUTTON_DATA_INVALID|MESSAGE_ID_INVALID|MSG_ID_INVALID)$/.test(error.errorMessage || error.message || ''))
            return this.expiredResult('This Telegram button is no longer valid. Request a fresh search result.');
          throw error;
        }
        signal.throwIfAborted();
        if(isExpiredSearchNotice(answer.message))return this.expiredResult(answer.message);
        if (answer.url) {
          const next = parseDiscoveryLink(answer.url);
          if (!next) throw new Error("The bot returned an unsupported link. Open this result in Telegram.");
          return this.presentMessages([{id:target.messageId,message:answer.message || "",replyMarkup:{rows:[{buttons:[{text:"Continue to series",url:answer.url}]}]}}],target.peer,{synthetic:true});
        }
        if(answer.alert && answer.message) {
          const result=this.presentMessages(current,target.peer,{queryId:target.queryId,botIds:target.botIds});
          result.notice=String(answer.message).slice(0,4000);
          result.messages.forEach(message=>message.links.forEach(link=>{link.automatic=false;}));
          return result;
        }
        if(privateBot && this.selection?.resolution) return this.responses(client,target.peer,Math.max(target.messageId,...beforeDelivery.map(message=>message.id)),signal);
        let edited = current;
        const before = JSON.stringify(current.map(messageFingerprint));
        for (let attempt=0; attempt<6; attempt++) {
          edited = await client.getMessages(target.peer,{ids:[target.messageId]});
          signal.throwIfAborted();
          if (answer.alert || JSON.stringify(edited.map(messageFingerprint)) !== before) break;
          if (attempt<5) await this.wait(1000,undefined,{signal});
        }
        // Some callbacks send a new reply instead of editing the selected message.
        if(JSON.stringify(edited.map(messageFingerprint))===before) {
          if(privateBot) return this.responses(client,target.peer,Math.max(target.messageId,...beforeDelivery.map(message=>message.id)),signal);
          if(target.queryId && target.botIds)
            return this.responses(client,target.peer,target.queryId,signal,{botIds:target.botIds,threaded:false,excludeIds:[target.messageId],callbackId:target.messageId});
        }
        const result = this.presentMessages(edited.filter(message=>message?.id === target.messageId),target.peer,{queryId:target.queryId,botIds:target.botIds});
        if (answer.message) result.notice = answer.message;
        // Pagination and callbacks without a returned URL require selection;
        // do not automatically press the same keyboard repeatedly.
        result.messages.forEach(message=>message.links.forEach(link=>{ if (link.kind === "callback" || answer.alert) link.automatic=false; }));
        return result;
      }
      if (target.kind === "private-message") return this.readLinkedMessage(client,target,signal);
      if (target.kind === "bot-start") {
        const bot = await this.bot(client,target.username);
        if(/^MCFHelper/i.test(target.username))this.manualFlow=true;
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
        if (entity.className === "User" && entity.bot && isMcfBot(target.username)) {
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
  subscriptionChoices() {
    return [...this.choices].filter(([,target])=>['invite','public-peer'].includes(target.kind) && !/bot$/i.test(target.username || ''))
      .map(([id,target])=>({id,label:target.label || target.username || 'Required channel'}));
  }
  async completeSubscriptions(ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length>10 || new Set(ids).size!==ids.length) throw new Error('Select between one and ten required channels');
    const allowed = new Set(this.subscriptionChoices().map(choice=>choice.id));
    if(ids.some(id=>!allowed.has(id))) throw new Error('Subscription choices expired. Open the bot result again.');
    const resume = this.resumeTarget;
    const search = this.resumeSearch;
    if(!resume && !search) throw new Error('Open the series bot first so its request can be retried after joining.');
    for(const id of ids) await this.join(id,true);
    if(!resume) {
      const id=randomUUID();
      this.searchSource={...search.source,id,expires:this.now()+300000};
      return this.search(search.query,id);
    }
    const id=randomUUID();this.choices.set(id,resume);
    return this.follow(id);
  }
  async join(id, subscription = false) {
    const target = this.choices.get(id);
    if (!target || !["invite","public-peer"].includes(target.kind)) throw new Error("Channel choice expired");
    return this.run(async(client,signal)=>{
      let entity;
      const valid=entity=>entity && (subscription ? ["Channel","Chat"].includes(entity.className) : entity.className === "Channel" && entity.broadcast);
      if (target.kind === "invite") {
        const preview = await client.invoke(new Api.messages.CheckChatInvite({hash:target.invite}));
        entity = preview.chat;
        if (!entity && !subscription && (!preview.channel || preview.megagroup)) throw new Error("This is not a broadcast channel invite");
        if (entity && !valid(entity)) throw new Error("This is not a broadcast channel");
        signal.throwIfAborted();
        if (!entity || entity.left) {
          const updates = await client.invoke(new Api.messages.ImportChatInvite({hash:target.invite}));
          entity = updates.chats?.find(chat=>valid(chat));
          // A successful import can return updates without a full chat entity.
          // Recheck this exact invite rather than guessing from recent dialogs.
          if (!entity) entity = (await client.invoke(new Api.messages.CheckChatInvite({hash:target.invite}))).chat;
        }
      } else {
        entity = await client.getEntity(target.username);
        if (!valid(entity)) throw new Error("This is not a broadcast channel");
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
