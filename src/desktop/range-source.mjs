import bigInt from 'big-integer';
import {getFileInfo} from 'teleproto/Utils.js';

// Teleproto 1.229.0's public downloadFile uses this scheduler, but cannot
// resume at an offset. Isolate the pinned internal bridge here so resumed
// downloads also use its shared connection pool, deadlines and cancellation.
export function rangeSource(client,media) {
  if(typeof client._media?.getFile==='function') {
    const info=getFileInfo(media);
    let dcId=info.dcId ?? client.session.dcId;
    return {window:8,read:(offset,size,signal)=>client._media.getFile(dcId,info.location,bigInt(offset),size,signal,value=>{dcId=value;})};
  }
  return {window:4,async read(offset,size,signal) {
    const chunks=[];
    for await (const chunk of client.iterDownload(media,{offset:bigInt(offset),requestSize:size,limit:size,signal})) chunks.push(chunk);
    return Buffer.concat(chunks);
  }};
}
