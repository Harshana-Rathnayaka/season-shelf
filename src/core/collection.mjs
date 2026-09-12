export function missingEpisodes(items, jobs, channelId, mode) {
  const covered = new Set();
  for (const job of jobs) {
    if (job.status !== 'complete' || job.mode !== mode || String(job.item.peer?.id) !== String(channelId) || job.item.unverified) continue;
    for (let n=job.item.episode;n<=(job.item.episodeEnd ?? job.item.episode);n++) covered.add(`${job.item.season}:${n}`);
  }
  return items.filter(item=>{
    for(let n=item.episode;n<=(item.episodeEnd ?? item.episode);n++) if(!covered.has(`${item.season}:${n}`)) return true;
    return false;
  });
}

export function unverifiedItems(items) {
  return items.filter(item=>item.reason && Number.isSafeInteger(item.size) && item.size>0)
    .map(item=>({...item,unverified:true}));
}
