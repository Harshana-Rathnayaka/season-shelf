import { Api } from 'teleproto';
import { parseEpisode } from '../core/catalog.mjs';
import { messageText } from '../core/telegram-content.mjs';

export function episodeFromMessage(message, peer) {
  if (!message || message.out || message.noforwards) return null;
  const mediaDocument = message.media instanceof Api.MessageMediaDocument ? message.media.document
    : message.media instanceof Api.MessageMediaWebPage ? message.media.webpage?.document : null;
  const doc = message.document || (mediaDocument instanceof Api.Document ? mediaDocument : null);
  if (!doc) return null;
  const filename = doc.attributes?.find(a => a.className === 'DocumentAttributeFilename')?.fileName || '';
  return parseEpisode({ id:String(message.id), peer, filename, caption:messageText(message),
    size:Number(doc.size), documentId:String(doc.id) });
}
