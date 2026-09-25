import {missingEpisodes} from "../core/collection.mjs";
import {selectEpisodes} from '../core/catalog.mjs';

export class SeriesWatcher {
  constructor({store,adapter,queue,notify}) {
    Object.assign(this,{store,adapter,queue,notify});this.watches=store.get('watches',[]);
    this.timer=setInterval(()=>this.check().catch(error=>{this.lastError=error.message;}),60*60*1000);this.timer.unref();
  }
  set(catalogue,{mode,quality,automatic},root) {
    if(!catalogue || !['archive','watch'].includes(mode) || ![true,false,null].includes(automatic)) throw new Error('Choose a series and watch mode');
    selectEpisodes(catalogue.items,mode,quality);
    if(automatic && !root) throw new Error("Choose a download folder first");
    const key=`${catalogue.channel.id}:${mode}`;
    const previous=this.watches.find(watch=>watch.key===key);
    this.watches=this.watches.filter(watch=>watch.key!==key);
    if(automatic!==null) {
      this.watches.push({key,channel:catalogue.channel,mode,quality,automatic,root,lastId:Math.max(previous?.lastId || 0,catalogue.lastMessageId || 0,...catalogue.items.map(item=>Number(item.id))),createdAt:Date.now()});
    }
    this.store.set('watches',this.watches);return this.watches;
  }
  async check() {
    if(this.stopped || this.checking || !this.adapter.connected) return;
    this.checking=true;
    try {
      for(const watch of this.watches) {
        try {
          const catalogue=await this.adapter.scan(watch.channel,{minId:watch.lastId,limit:1000});
          if(catalogue.truncated) throw new Error('More than 1,000 new posts. Rescan and reset this watch to avoid skipping episodes.');
          if(this.stopped || !this.watches.includes(watch)) continue;
          const reserved=this.queue.jobs.map(job=>!["cancelled","deleted","missing"].includes(job.status) ? {...job,status:"complete"} : job);
          const items=missingEpisodes(selectEpisodes(catalogue.items,watch.mode,watch.quality),reserved,watch.channel.id,watch.mode);
          if(watch.automatic && items.length) await this.queue.add({items,series:watch.channel.title,mode:watch.mode,root:watch.root});
          if(items.length) this.notify({title:watch.channel.title,count:items.length,automatic:watch.automatic});
          watch.lastId=Math.max(watch.lastId,catalogue.lastMessageId || 0,...catalogue.items.map(item=>Number(item.id)));watch.error='';watch.checkedAt=Date.now();
        } catch(error) {watch.error=error.message;}
      }
      this.store.set('watches',this.watches);
    } finally {this.checking=false;}
  }
  stop() {this.stopped=true;clearInterval(this.timer);}
}
