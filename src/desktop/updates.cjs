const {autoUpdater}=require('electron-updater');
const {acceptsUpdate}=require('./environment.cjs');
exports.installUpdates=({app,runtime={environment:'production',channel:'latest'},handle,notify,settings,saveSettings,busy,beforeInstall,platform=process.platform,openReleases})=>{
  if(platform !== 'win32') {
    const status={state:app.isPackaged?'manual':'development',version:app.getVersion()};
    handle('update-status',()=>status);
    handle('update-check',async()=>{if(app.isPackaged) await openReleases();return status;});
    for(const name of ['update-download','update-install','update-later']) handle(name,async()=>{throw new Error('Install macOS updates from GitHub Releases.');});
    handle('update-preference',()=>settings());
    return ()=>{};
  }
  let status={state:app.isPackaged?'idle':'development',version:app.getVersion(),lastCheckedAt:settings().lastUpdateCheckAt || null};
  let checking=false, installing=false;
  const deferredAtLaunch=settings().deferredUpdate;
  const later=()=>{settings().deferredUpdate=status.version;saveSettings();set("ready",{deferred:true});return status;};
  const install=async()=>{
    if(!app.isPackaged || !acceptsUpdate(runtime.environment,status.version)) throw new Error('This update is not for this application environment');
    if(status.state!=="ready") throw new Error("Download the update first");
    if(busy()) throw new Error("Pause downloads and finish current operations before restarting");
    if(installing) return {}; installing=true;
    try {await beforeInstall();autoUpdater.quitAndInstall(false,true);return {};}
    catch(error){installing=false;throw error;}
  };
  const set=(state,extra={})=>{status={...status,state,...extra};notify('updates',status);};
  const failed=error=>{
    console.error('Update check failed:', error);
    set(/No published versions/i.test(error.message || '') ? 'unpublished' : 'error', {message:'',percent:undefined});
  };
  autoUpdater.autoDownload=false;
  autoUpdater.autoInstallOnAppQuit=false;
  autoUpdater.channel=runtime.channel || 'latest';
  autoUpdater.allowPrerelease=false;
  // Setting channel enables downgrades in electron-updater; disable that explicitly.
  autoUpdater.allowDowngrade=false;
  autoUpdater.on('error',failed);
  autoUpdater.on('checking-for-update',()=>set('checking',{message:''}));
  autoUpdater.on('update-available',info=>{
    if(!app.isPackaged || !acceptsUpdate(runtime.environment,info.version)) {set('current');return;}
    set('available',{version:info.version});
    {set("downloading",{percent:0});autoUpdater.downloadUpdate().catch(failed);}
  });
  autoUpdater.on('update-not-available',()=>set('current'));
  autoUpdater.on('download-progress',progress=>set('downloading',{percent:Math.round(progress.percent)}));
  autoUpdater.on('update-downloaded',info=>{
    if(!app.isPackaged || !acceptsUpdate(runtime.environment,info.version)) {set('current');return;}
    set('ready',{version:info.version,deferred:deferredAtLaunch===info.version});
    if(deferredAtLaunch===info.version && !busy()) install().catch(failed);
  });
  const check=async()=>{
    if(!app.isPackaged) return status;
    if(checking || ['downloading','ready'].includes(status.state)) return status;
    checking=true;
    const lastCheckedAt=new Date().toISOString();
    settings().lastUpdateCheckAt=lastCheckedAt;
    saveSettings();
    set("checking",{lastCheckedAt,message:""});
    try {await autoUpdater.checkForUpdates();} catch(error){failed(error);}
    finally {checking=false;}
    return status;
  };
  handle('update-status',()=>status);
  handle('update-check',check);
  handle('update-download',async()=>{
    if(!app.isPackaged || !acceptsUpdate(runtime.environment,status.version)) throw new Error('This update is not for this application environment');
    if(status.state!=='available') throw new Error('Check for an available update first');
    set('downloading',{percent:0});
    autoUpdater.downloadUpdate().catch(failed);return status;
  });
  handle('update-preference',({enabled})=>{
    if(typeof enabled!=='boolean') throw new Error('Invalid update preference');
    settings().automaticUpdates=enabled;saveSettings();return settings();
  });
  handle('update-install',install);
  handle('update-later',()=>{if(status.state!=='ready') throw new Error('No downloaded update to defer');return later();});
  // Keep startup responsive and check daily while the app remains open.
  const timer=setTimeout(check,1500);timer.unref();
  const daily=setInterval(check,86400000);daily.unref();
  return ()=>{clearTimeout(timer);clearInterval(daily);};
};
