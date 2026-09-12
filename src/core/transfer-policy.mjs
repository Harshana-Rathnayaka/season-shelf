import { setTimeout as delay } from 'node:timers/promises';

export function cleanTransfer(value = {}) {
  const speedKiB = Number(value.speedKiB ?? 0);
  const start = value.start ?? '00:00', end = value.end ?? '00:00';
  if (!Number.isInteger(speedKiB) || speedKiB < 0 || speedKiB > 1048576 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new Error('Invalid transfer settings');
  return {speedKiB,start,end,scheduled:value.scheduled === true};
}
export function withinSchedule(settings, date = new Date()) {
  if (!settings.scheduled || settings.start === settings.end) return true;
  const time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  return settings.start < settings.end ? time >= settings.start && time < settings.end : time >= settings.start || time < settings.end;
}
export class TransferPolicy {
  constructor(settings = {}, {now=Date.now,wait=delay} = {}) { this.now=now;this.wait=wait;this.configure(settings); }
  configure(settings) { this.settings=cleanTransfer(settings);this.next=0;this.version=(this.version || 0)+1; }
  allowed() { return withinSchedule(this.settings,new Date(this.now())); }
  async acquire(bytes, signal) {
    for (;;) {
      signal?.throwIfAborted();
      if (this.allowed()) {
        if (!this.settings.speedKiB) return;
        if(this.now()>=this.next) {
          // Reserve only when the request actually starts. Cancelled waiting
          // requests must not leave minutes of unused bandwidth reservations.
          this.next=this.now()+bytes/(this.settings.speedKiB*1024)*1000;
          return;
        }
      }
      await this.wait(this.allowed()?Math.min(500,Math.max(1,this.next-this.now())):500,undefined,{signal});
    }
  }
}
