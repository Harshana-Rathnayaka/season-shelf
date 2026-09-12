// Deliberately supports only discovery links, not arbitrary Telegram actions.
// Parsing does not authorise a join, send a message, or prove an entity is a bot.
export function parseDiscoveryLink(input) {
  if (typeof input !== "string" || input.length > 2048) return null;
  let url;
  try { url = new URL(input.trim().replace(/^(?:www\.)?(t\.me|telegram\.me)\//i,"https://$1/")); } catch { return null; }
  if (url.username || url.password || url.port || url.hash) return null;
  const privatePath = /^(?:\/c\/)([1-9]\d{0,18})\/([1-9]\d{0,9})\/?$/.exec(url.pathname);
  const privateScheme = url.protocol === "tg:" && url.hostname === "privatepost" && !url.pathname;
  if ((url.protocol === "https:" && ["t.me", "telegram.me"].includes(url.hostname) && privatePath) || privateScheme) {
    const channelId = privatePath?.[1] || url.searchParams.get("channel");
    const messageId = privatePath?.[2] || url.searchParams.get("post");
    const allowed = privateScheme ? ["channel", "post", "single"] : ["single"];
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return null;
    if (!/^[1-9]\d{0,18}$/.test(channelId || "") || BigInt(channelId) > 9223372036854775807n || !/^[1-9]\d{0,9}$/.test(messageId || "") || Number(messageId) > 2147483647) return null;
    return {kind:"private-message",channelId,messageId:Number(messageId)};
  }
  let username, invite;
  if (url.protocol === "https:" && ["t.me", "telegram.me"].includes(url.hostname)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0].startsWith("+")) invite = parts[0].slice(1);
    else if (parts.length === 2 && parts[0] === "joinchat") invite = parts[1];
    else if (parts.length === 1) username = parts[0];
    else return null;
  } else if (url.protocol === "tg:" && (!url.pathname || url.pathname === "/")) {
    if (url.hostname === "resolve") username = url.searchParams.get("domain");
    else if (url.hostname === "join") invite = url.searchParams.get("invite");
    else return null;
  } else return null;
  const allowed = url.protocol === "tg:" ? ["domain", "invite", "start"] : ["start"];
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return null;
  if (invite !== undefined && invite !== null) {
    if (url.searchParams.has("start") || url.searchParams.has("domain")) return null;
    return /^[A-Za-z0-9_-]{8,128}$/.test(invite) && !/^\d+$/.test(invite) ? {kind:"invite",invite} : null;
  }
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username || "") || url.searchParams.has("invite")) return null;
  if (["share","login","proxy","socks","addlist","addstickers","addemoji","addtheme","boost","invoice","confirmphone","setlanguage"].includes(username.toLowerCase())) return null;
  if (url.searchParams.has("start")) {
    const start = url.searchParams.get("start");
    return /^[A-Za-z0-9_-]{0,64}$/.test(start) ? {kind:"bot-start",username,start} : null;
  }
  return {kind:"public-peer",username};
}

export function discoveryLinks(message) {
  const text = String(message.message || "").slice(0, 65536);
  const candidates = [];
  for (const row of (message.replyMarkup?.rows || []).slice(0,100))
    for (const button of (row.buttons || []).slice(0,100)) {
      // Layer 229 nests action fields inside KeyboardInlineButton.type.
      // Retain legacy support for cached messages and older schemas.
      const action = button.type || button;
      const urlButton = !button.type || action.className === "InlineButtonTypeUrl";
      if (urlButton && action.url) candidates.push({label:String(button.text || "Telegram link"),url:action.url,button:true});
      else if (["KeyboardButtonCallback", "InlineButtonTypeCallback"].includes(action.className) && action.data?.length && action.data.length <= 64 && !action.requiresPassword)
        candidates.push({label:String(button.text || "Bot result"),target:{kind:"callback",data:Array.from(action.data)}});
      else candidates.push({label:String(button.text || "Telegram button"),target:{kind:"unsupported",buttonType:action.className || "Unknown"}});
    }
  for (const entity of (message.entities || []).slice(0,200)) {
    if (entity.className === "MessageEntityTextUrl") candidates.push({label:text.slice(entity.offset,entity.offset + entity.length),url:entity.url});
    if (entity.className === "MessageEntityUrl") {
      const url = text.slice(entity.offset,entity.offset + entity.length);
      candidates.push({label:url,url});
    }
  }
  for (const match of text.matchAll(/(?:https:\/\/(?:t\.me|telegram\.me)\/|\bt\.me\/|tg:\/\/)[^\s<>]+/g))
    candidates.push({label:match[0],url:match[0].replace(/[.,!;)]*$/,"")});
  const seen = new Set();
  return candidates.flatMap(candidate => {
    const target = candidate.target || parseDiscoveryLink(candidate.url) || (candidate.button ? {kind:"unsupported",buttonType:"Link format"} : null);
    const key = JSON.stringify(target) + (target?.kind === "unsupported" ? candidate.label : "");
    if (!target || seen.has(key)) return [];
    seen.add(key);
    const navigation = /^(?:[\s\p{P}\p{S}]*\d+\s*\/\s*\d+[\s\p{P}\p{S}]*|[\s\p{P}\p{S}]*)$/u.test(candidate.label) || /\b(next|previous|prev|back|page|subscribe|subscription|verify|request|join required)\b/i.test(candidate.label);
    const ancillary = target.kind === "public-peer" && /(?:_chat$|^MovieClubFamily$)/i.test(target.username);
    return [{label:candidate.label.slice(0,200),target,automatic:target.kind !== "unsupported" && !navigation && !ancillary}];
  });
}
