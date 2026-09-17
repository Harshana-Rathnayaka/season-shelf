const {Tray,Menu,nativeImage,Notification,app}=require('electron');
exports.installTray = ({win,queue,settings,isQuitting,enabled=true}) => {
  if(!enabled) {
    win.on('close',()=>{if(!isQuitting())queue.controlAll('pause');});
    return null;
  }
  const pixels=Buffer.alloc(32*32*4);
  for(let y=4;y<28;y++) for(let x=5;x<27;x++) {
    if(x<8 || x>23 || y<7 || y>24 || (y>14 && y<18)) {
      const at=(y*32+x)*4;pixels[at]=198;pixels[at+1]=228;pixels[at+2]=160;pixels[at+3]=255;
    }
  }
  const tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));
  const show=()=>{win.show();if(win.isMinimized())win.restore();win.focus();};
  tray.setToolTip('Season Shelf');tray.on('click',show);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Open Season Shelf',click:show},
    {label:'Pause downloads',click:()=>queue.controlAll('pause')},
    {label:'Resume downloads',click:()=>queue.controlAll('resume')},
    {type:'separator'},{label:'Quit Season Shelf',click:()=>app.quit()}
  ]));
  win.on('close',event=>{if(!isQuitting()) queue.controlAll('pause');if(!isQuitting() && settings().closeToTray!==false) {event.preventDefault();win.hide();}});
  const completed=new Set(queue.jobs.filter(job=>job.status==='complete').map(job=>job.id));
  queue.on('change',jobs=>{
    const fresh=jobs.filter(job=>job.status==='complete' && !completed.has(job.id));
    fresh.forEach(job=>completed.add(job.id));
    if(fresh.length && Notification.isSupported()) {
      const notice=new Notification({title:'Download complete',body:fresh.length===1?fresh[0].item.filename:`${fresh.length} files saved`});
      notice.on('click',show);notice.show();
    }
    const count=jobs.filter(job=>['downloading','checking','transferring'].includes(job.status)).length;
    tray.setToolTip(count?`Season Shelf - ${count} active`:'Season Shelf');
  });
  return tray;
};
