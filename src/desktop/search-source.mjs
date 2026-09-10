import { Api } from "teleproto";
import bigInt from "big-integer";

export function requireSearchGroup(entity) {
  if (!(entity?.className === "Chat" || (entity?.className === "Channel" && entity.megagroup && !entity.broadcast)))
    throw new Error("MovieClubFamily has no available group for posting searches. Use a Telegram result link instead.");
  if (entity.left || entity.kicked || entity.deactivated)
    throw new Error("Join the search group in Telegram before searching here.");
  if (entity.forum)
    throw new Error("This search group uses topics. Search in Telegram and paste the result link for now.");
  if (entity.bannedRights?.sendMessages || entity.bannedRights?.sendPlain ||
      (!entity.creator && !entity.adminRights && (entity.defaultBannedRights?.sendMessages || entity.defaultBannedRights?.sendPlain)))
    throw new Error("You cannot post a search in this group. Use a Telegram result link instead.");
  return entity;
}

export async function resolveSearchSource(client, signal) {
  const entry = await client.getEntity("MovieClubFamily");
  signal.throwIfAborted();
  let group = entry;
  let linked = false;
  if (entry.className === "Channel" && entry.broadcast) {
    const full = await client.invoke(new Api.channels.GetFullChannel({channel:await client.getInputEntity(entry)}));
    signal.throwIfAborted();
    const linkedId = full.fullChat?.linkedChatId;
    if (!linkedId || String(linkedId) === "0") {
      const error = new Error("MovieClubFamily is a broadcast channel with no linked search group.");
      error.code = "SEARCH_GROUP_UNRESOLVED";
      throw error;
    }
    group = full.chats?.find(chat=>String(chat.id) === String(linkedId));
    if (!group) group = await client.getEntity(new Api.PeerChannel({channelId:bigInt(String(linkedId))}));
    linked = true;
  }
  signal.throwIfAborted();
  requireSearchGroup(group);
  return {entity:group,peer:await client.getInputEntity(group),linked};
}

export function isSearchReply(message, botId, requestId) {
  const sender = message.fromId;
  if (sender && sender.className !== "PeerUser") return false;
  const senderId = sender?.userId ?? message.senderId;
  return !message.out && String(senderId) === String(botId) && message.id > requestId &&
    (message.replyTo?.replyToMsgId === requestId || message.replyTo?.replyToTopId === requestId);
}
