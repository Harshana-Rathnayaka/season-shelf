import { createHash } from 'node:crypto';
import { episodeFromMessage } from './telegram-media.mjs';

export function deliveryCatalogue(messages, bot, selection = {}, { complete = false, truncated = false, now = Date.now() } = {}) {
  const peer = { id:String(bot.id), type:'user', accessHash:String(bot.accessHash || 0) };
  const seen = new Set();
  const items = messages.map(message => episodeFromMessage(message, peer)).filter(item => {
    if (!item || !Number.isSafeInteger(item.size) || item.size<=0 || seen.has(item.documentId)) return false;
    if (selection.season != null && item.season != null && item.season !== selection.season) return false;
    if (selection.episode != null && item.episode != null && (selection.episode < item.episode || selection.episode > item.episodeEnd)) return false;
    if (selection.resolution && item.resolution && item.resolution !== selection.resolution) return false;
    seen.add(item.documentId); return true;
  });
  if (!items.length) return null;
  const seriesKey = filename => filename.split(/[._ -]+S\d{1,2}[._ -]*E\d/i)[0]
    .replace(/\[[^\]]*\]/g,'').replace(/\b(?:19|20)\d{2}\b/g,'').normalize('NFKC')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const series = new Set(items.map(item=>seriesKey(item.filename)).filter(Boolean));
  if (series.size>1)
    for(const item of items) item.reason='Files from more than one series arrived together. Verify each filename manually.';
  const inferred = items[0].filename.split(/[._ -]+S\d{1,2}[._ -]*E\d/i)[0].replace(/[._]/g, ' ').trim();
  const title = selection.title || inferred || 'MCF bot delivery';
  const identity = title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const collectionId = `bot:${bot.id}:${createHash('sha256').update(identity).digest('hex').slice(0,20)}`;
  for (const item of items) item.collectionId = collectionId;
  const episodes = new Set();
  for (const item of items.filter(item => !item.reason))
    for (let n=item.episode; n<=item.episodeEnd; n++) episodes.add(`${item.season}:${n}`);
  const missing = selection.expected && episodes.size < selection.expected;
  return { channel:{ id:collectionId, title, peer }, items, source:'bot', scanned:messages.length,
    scannedAt:new Date(now).toISOString(), truncated,
    delivery:{ bot:bot.username || 'MCF bot', afterId:0, expected:selection.expected || null,
      received:episodes.size, complete:complete && !missing && !truncated, selection },
    sourceWarning: `Bot-delivered messages may be deleted. Download selected files promptly.${missing ? ` Received ${episodes.size} of ${selection.expected} expected episodes; check the delivery again.` : !complete ? ' Delivery may still be arriving; check again for more files.' : ''}` };
}
