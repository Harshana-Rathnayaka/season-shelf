export function parseEpisode(record) {
  const filename = String(record.filename || "");
  const caption = String(record.caption || "");
  if (!/\.(mkv|mp4|avi|webm|m4v)$/i.test(filename)) return null;
  const text = `${filename} ${caption}`;
  const tokens = [...text.replaceAll("_", ".").matchAll(/\bS(\d{1,2})[ .-]*E(\d{1,3})(?!\d)(?:[ .-]*E(\d{1,3})(?!\d)|-(\d{1,3})(?!\d))?/gi)];
  const identities = new Set(tokens.map(m => `${+m[1]}:${+m[2]}`));
  const ends = tokens.map(m=>+(m[3] || m[4] || m[2]));
  const combined = tokens.some(m=>m[3] || m[4]);
  const invalidCombined = tokens.some((m,index)=>ends[index] < +m[2] || ends[index] > +m[2]+1) || new Set(tokens.filter(m=>m[3] || m[4]).map(m=>+(m[3] || m[4]))).size > 1 || /E\d{1,3}[ ._-]*E\d{1,3}[ ._-]*E\d/i.test(text);
  const resolutions = [
    ...new Set(
      [...text.matchAll(/(?:^|[^\d])(480|720|1080|2160)p\b/gi)].map(
        (m) => +m[1],
      ),
    ),
  ];
  // Filenames frequently have underscores directly after the resolution.
  if (!resolutions.length)
    resolutions.push(
      ...new Set(
        [
          ...text
            .replaceAll("_", ".")
            .matchAll(/(?:^|[^\d])(480|720|1080|2160)p\b/gi),
        ].map((m) => +m[1]),
      ),
    );
  const hevc = /(?:x[ ._-]?265|h[ ._-]?265|hevc)/i.test(text);
  const avc = /(?:x[ ._-]?264|h[ ._-]?264|\bavc\b)/i.test(text);
  const reason =
    identities.size !== 1
      ? "Season or episode is missing or conflicting"
      : invalidCombined
        ? "Episode range is ambiguous or not a consecutive pair"
        : resolutions.length !== 1
          ? "Resolution is missing or conflicting"
          : hevc === avc
            ? "Codec is missing or conflicting"
            : null;
  const token = tokens[0];
  const season = token ? +token[1] : null;
  const episode = token ? +token[2] : null;
  const titleText =
    caption.split("\n").find((line) => /S\d{1,2}[ ._-]*E\d/i.test(line)) ||
    filename;
  const title =
    titleText
      .replace(/^.*?S\d{1,2}[ ._-]*E\d{1,3}(?:[ ._-]*E\d{1,3}|-\d{1,3})?/i, "")
      .replace(/[._]/g, " ")
      .replace(/(?:480|720|1080|2160)p.*$/i, "")
      .replace(/^[\s-]+|[\s-]+$/g, "") || `Episode ${episode ?? "?"}`;
  return {
    ...record,
    filename,
    caption,
    season,
    episode,
    episodeEnd: combined ? Math.max(...ends) : episode,
    title,
    resolution: resolutions[0] ?? null,
    codec: hevc && !avc ? "HEVC" : avc && !hevc ? "H.264" : null,
    bitDepth: /10[ ._-]?bit/i.test(text) ? 10 : null,
    reason,
    size: Number(record.size),
    id: String(record.id),
  };
}

export function selectEpisodes(records, mode = "archive", quality = {}) {
  const resolution = quality.resolution ?? (mode === "archive" ? 720 : 1080);
  const codec = quality.codec ?? (mode === "archive" ? "HEVC" : "any");
  if (![480, 720, 1080, 2160].includes(resolution) ||
      !["HEVC", "H.264", "any"].includes(codec)) throw new Error("Invalid quality selection");
  const groups = new Map();
  for (const item of records) {
    if (
      item.reason ||
      item.resolution !== resolution ||
      !Number.isSafeInteger(item.size) ||
      item.size <= 0
    )
      continue;
    if (codec !== "any" && item.codec !== codec) continue;
    const key = `${item.season}:${item.episode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const covered = new Set();
  return [...groups.values()]
    .map((options) => {
      options.sort(
        (a, b) =>
          ((b.episodeEnd || b.episode) - b.episode) - ((a.episodeEnd || a.episode) - a.episode) ||
          (a.codec === "HEVC" ? 0 : 1) - (b.codec === "HEVC" ? 0 : 1) ||
          a.size - b.size ||
          a.id.localeCompare(b.id),
      );
      return { ...options[0], alternatives: options.length - 1 };
    })
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
    .filter(item=>{
      const numbers = Array.from({length:(item.episodeEnd || item.episode)-item.episode+1},(_,i)=>`${item.season}:${item.episode+i}`);
      if (numbers.some(key=>covered.has(key))) return false;
      numbers.forEach(key=>covered.add(key)); return true;
    });
}

export function availableQualities(records) {
  const groups = new Map();
  for (const item of records) {
    if (item.reason || !Number.isSafeInteger(item.size) || item.size <= 0 ||
        ![480, 720, 1080, 2160].includes(item.resolution) ||
        !["HEVC", "H.264"].includes(item.codec)) continue;
    if (!groups.has(item.resolution)) groups.set(item.resolution, new Set());
    groups.get(item.resolution).add(item.codec);
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([resolution, codecs]) => ({
    resolution, codecs: ["HEVC", "H.264"].filter(codec => codecs.has(codec)),
  }));
}

export function availableSelection(records, mode, preference = {}) {
  const options = availableQualities(records);
  const desired = preference.resolution ?? (mode === "archive" ? 720 : 1080);
  const target = options.find(o => o.resolution === desired) ||
    options.filter(o => o.resolution < desired).at(-1) || options[0];
  if (!target) return { resolution: desired, codec: preference.codec ?? (mode === "archive" ? "HEVC" : "any") };
  const codec = preference.codec ?? (mode === "archive" ? "HEVC" : "any");
  return { resolution: target.resolution, codec: codec === "any" && target.codecs.length > 1
    ? "any" : target.codecs.includes(codec) ? codec : target.codecs[0] };
}

export const defaultHiddenKeywords = ["crypto", "cryptocurrency", "forex", "bitcoin", "binance", "trading", "trader", "traders", "airdrop", "airdrops", "nft", "nfts", "stock", "stocks", "fx signal", "fx signals", "signals", "gold", "profit", "market", "exchange"];
export function cleanKeywords(values) {
  if (!Array.isArray(values) || values.length > 200) throw new Error("Use at most 200 keywords");
  return [...new Set(values.map(value => String(value).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()).filter(Boolean))].map(value => {
    if (value.length > 60) throw new Error("Keep each keyword under 60 characters");
    return value;
  });
}
export function channelCategory(title, keywords = defaultHiddenKeywords) {
  const words = String(title).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
  if (/\b(movies?|cinema|films?|tv|series|seasons?|episodes?|webseries|sitcoms?|anime|netflix|hollywood|bollywood)\b/.test(words)) return "media";
  if (keywords.some(keyword => (` ${words.trim()} `).includes(` ${keyword} `))) return "finance";
  return "other";
}

export const pad = (number) => String(number).padStart(2, "0");
export function normalizeSeasonNames(items) {
  const protect = stem => {
    const fragments = [];
    const text = stem.replace(/WEB-DL|WEB-RIP|(?:HEVC|AVC|x265|x264)-[a-z0-9]+|(?<![a-z0-9])\d+\.\d+(?![a-z0-9])/gi, value => {
      fragments.push(value);
      return `\u0000${fragments.length - 1}\u0000`;
    });
    return { text, restore: text => text.replace(/\u0000(\d+)\u0000/g, (_, i) => fragments[Number(i)]) };
  };
  const votes = new Map();
  for (const item of items) {
    const {text} = protect(item.filename.replace(/\.[^.]+$/, ""));
    const counts = [".", "_", "-"].map(separator => [separator, text.split(separator).length - 1]).sort((a,b) => b[1]-a[1]);
    const vote = votes.get(item.season) || {".":0,"_":0,"-":0};
    if (counts[0][1] > counts[1][1]) vote[counts[0][0]]++;
    votes.set(item.season, vote);
  }
  return items.map(item => {
    const counts = Object.entries(votes.get(item.season)).sort((a,b)=>b[1]-a[1]);
    if (counts[0][1] === counts[1][1]) return {...item,destinationFilename:item.filename};
    const ext=item.filename.match(/\.[^.]+$/)?.[0] || "";
    const {text,restore}=protect(item.filename.slice(0,item.filename.length-ext.length));
    return {...item,destinationFilename:restore(text.replace(/[._-]/g,counts[0][0]))+ext};
  });
}
export function safeName(value, maxLength = 100) {
  let result = String(value)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ .]+$/g, "")
    .slice(0, maxLength)
    .replace(/[ .]+$/g, "");
  if (!result || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result))
    result = `Series ${result || "Untitled"}`;
  return result;
}
export function relativeDestination(series, item) {
  const filename = item.destinationFilename || item.filename;
  const ext = filename
    .match(/\.(mkv|mp4|avi|webm|m4v)$/i)?.[0];
  if (!ext || !Number.isInteger(item.season) || !Number.isInteger(item.episode))
    throw new Error("Invalid episode");
  return [
    `Season ${pad(item.season)}`,
    // Preserve every valid original character, including repeated spaces.
    // Only Windows-incompatible names need sanitizing before separator matching.
    /[<>:"/\\|?*\x00-\x1f]/.test(filename) || filename.length > 255 ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename)
      ? safeName(filename.slice(0, -ext.length), 255 - ext.length) + ext
      : filename,
  ];
}
