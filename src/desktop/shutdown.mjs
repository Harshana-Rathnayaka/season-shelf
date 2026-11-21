import {execFile} from 'node:child_process';
import path from 'node:path';

const finished=new Set(['complete','cancelled','deleted','missing','preview']);
const pending=job=>!finished.has(job.status);

export function requestWindowsShutdown({platform=process.platform,run=execFile,systemRoot=process.env.SystemRoot || 'C:\\Windows'}={}) {
  if(platform!=='win32')return Promise.reject(new Error('Automatic shutdown is available on Windows.'));
  return new Promise((resolve,reject)=>{
    // An OS timeout greater than zero implies forced application closure.
    // Count down inside the app, then request a normal, non-forced shutdown.
    run(path.join(systemRoot,'System32','shutdown.exe'),['/s','/t','0'],{windowsHide:true,shell:false},error=>error?reject(error):resolve());
  });
}

export class ShutdownWhenDone {
  constructor({queue,execute,notify=()=>{},isBusy=()=>false,supported=process.platform==='win32',now=Date.now,countdownSeconds=60}) {
    Object.assign(this,{queue,execute,notify,isBusy,supported,now,countdownSeconds});
    this.enabled=false;this.phase='off';this.message='';this.tracked=new Set();this.completed=new Set();this.epoch=0;
  }
  snapshot() {
    return {available:this.supported,enabled:this.enabled,phase:this.phase,
      remainingSeconds:this.phase==='countdown'?Math.ceil(this.remainingMs/1000):0,message:this.message};
  }
  publish() {
    const value=this.snapshot(),key=JSON.stringify(value);
    if(key!==this.published){this.published=key;try{this.notify(value);}catch{/* Notifications must not fail a download. */}}
    return value;
  }
  cancel(message='') {
    this.epoch++;
    clearInterval(this.timer);this.timer=null;this.enabled=false;this.phase='off';this.message=message;
    this.tracked.clear();this.completed.clear();this.remainingMs=0;
    return this.publish();
  }
  setEnabled(enabled) {
    if(typeof enabled!=='boolean')throw new Error('Choose whether to enable automatic shutdown.');
    if(this.phase==='requested')throw new Error('Windows shutdown has already been requested.');
    if(!enabled)return this.cancel();
    if(!this.supported)throw new Error('Automatic shutdown is available on Windows.');
    if(this.enabled)return this.snapshot();
    const jobs=this.queue.jobs.filter(pending);
    if(!jobs.length)throw new Error('Add downloads before enabling shutdown when finished.');
    this.tracked=new Set(jobs.map(job=>job.id));this.completed.clear();
    this.enabled=true;this.phase='waiting';this.message='Waiting for all downloads and disk work to finish.';
    this.timer=setInterval(()=>this.check(),1000);this.timer.unref?.();
    return this.check();
  }
  check() {
    if(!this.enabled)return this.snapshot();
    const jobs=new Map(this.queue.jobs.map(job=>[job.id,job]));
    for(const job of jobs.values())if(pending(job))this.tracked.add(job.id);
    for(const id of this.tracked)if(jobs.get(id)?.status==='complete')this.completed.add(id);
    for(const id of this.tracked) {
      const job=jobs.get(id);
      if(!this.completed.has(id) && (!job || finished.has(job.status)))
        return this.cancel('Shutdown cancelled because a download was removed or cancelled.');
    }
    const work=this.queue.recovering || this.queue.batching || this.queue.stopped || this.queue.running.size ||
      this.queue.tasks.size || this.queue.removals.size || this.queue.namingLocks.size || this.isBusy();
    const incomplete=[...jobs.values()].some(pending) || [...this.tracked].some(id=>!this.completed.has(id));
    const namingErrors=[...jobs.values()].some(job=>this.tracked.has(job.id) && (job.namingError || job.renamePending));
    if(work || incomplete || namingErrors) {
      this.phase='waiting';this.remainingMs=0;
      this.message=namingErrors?'Resolve filename errors before shutdown.':'Waiting for all downloads and disk work to finish.';
      return this.publish();
    }
    const now=this.now();
    if(this.phase!=='countdown') {
      this.phase='countdown';this.remainingMs=this.countdownSeconds*1000;
      this.message='All downloads are saved. You can cancel the shutdown.';
    } else {
      // Sleep or a clock jump must not consume the whole warning period.
      this.remainingMs-=Math.min(2000,Math.max(0,now-this.lastTick));
    }
    this.lastTick=now;
    if(this.remainingMs<=0) {
      clearInterval(this.timer);this.timer=null;this.enabled=false;this.phase='requested';
      this.message='Shutdown requested. Windows may ask you to save work in other apps.';
      const epoch=this.epoch;
      this.publish();
      this.execution=Promise.resolve().then(()=>epoch===this.epoch?this.execute():undefined).catch(()=>{
        if(epoch===this.epoch){this.phase='error';this.message='Windows could not start shutdown. You can shut down manually.';this.publish();}
      });
    }
    return this.publish();
  }
}
