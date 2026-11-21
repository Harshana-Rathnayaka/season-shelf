// Explicit integration identities, never accept arbitrary group participants.
export const mcfBots = Object.freeze(['MCFHelper01Bot', 'MCFHelper02Bot', 'MCFHelper03Bot', 'MCF_SeriesBot']);
export const isMcfBot = username => typeof username === 'string' && mcfBots.some(name => name.toLowerCase() === username.toLowerCase());

export function isExpiredSearchNotice(value) {
  if(typeof value!=='string')return false;
  const text=value.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').toLowerCase();
  return /\b(?:search|query|result|session|button|menu|message)\b[^.!?]{0,60}\b(?:expired|outdated|too old|no longer valid)\b/.test(text) ||
    /\b(?:expired|outdated)\s+(?:search|query|result|session|button|menu|message)\b/.test(text) ||
    /\b(?:search|query|result|session|button|menu|message)\s+(?:is\s+)?old\b/.test(text) ||
    /\b(?:search|query|result|session|button|menu|message)\b[^.!?]{0,80}(?:පරණ|කල්\s*ඉකුත්)/.test(text);
}

export const senderId = message => {
  if (message.fromId && message.fromId.className !== 'PeerUser') return null;
  const value = message.fromId?.userId ?? message.senderId;
  return value == null ? null : String(value);
};
export const isBotReply = (message, botId) => !message.out &&
  (!message.fromId || message.fromId.className === 'PeerUser') &&
  (!senderId(message) || senderId(message) === String(botId));

export function updateSelection(previous = {}, label = '') {
  const selection = { ...previous };
  const season = /\bSeason\s*(\d{1,2})\b/i.exec(label);
  const quality = /\b(480|720|1080|2160)p\b/i.exec(label);
  const episode = /^\W*E(\d{1,3})\b/i.exec(label);
  if (season) { selection.season = Number(season[1]); delete selection.episode; delete selection.expected; delete selection.resolution; }
  if (botActionHint(label) === 'Download entire season') { delete selection.episode; delete selection.expected; delete selection.resolution; }
  if (episode) { selection.episode = Number(episode[1]); selection.expected = 1; delete selection.resolution; }
  if (quality) {
    selection.resolution = Number(quality[1]);
    const count = /\bEpisodes?\s*[:\-]?\s*(\d{1,3})\b/i.exec(label);
    if (count) selection.expected = Number(count[1]);
    else if (selection.episode == null) delete selection.expected;
  }
  // Titles in MCF's disambiguation menu include their release year.
  if (!season && !quality && !episode && /\((?:19|20)\d{2}\)/.test(label)) {
    selection.title = label.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    delete selection.season; delete selection.episode; delete selection.resolution; delete selection.expected;
  }
  return selection;
}

export function botActionHint(label) {
  if (/මුළු.*(?:season|සීසන්)|(?:whole|entire|full)\s+season/i.test(label)) return 'Download entire season';
  if (/ආපසු/.test(label)) return 'Back';
  if (/ඊළඟ/.test(label)) return 'Next page';
  return '';
}
