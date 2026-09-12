const {autoUpdater}=require('electron-updater');
exports.installUpdates=({app,handle,notify,settings,saveSettings,busy,beforeInstall})=>{
  let status={state:app.isPackaged?'idle':'development',version:app.getVersion()};
  let checking=false, installing=false;
  const deferredAtLaunch=settings().deferredUpdate;
  const later=()=>{settings().deferredUpdate=status.version;saveSettings();set("ready",{deferred:true});return status;};
  const install=async()=>{
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
  autoUpdater.on('error',failed);
  autoUpdater.on('checking-for-update',()=>set('checking',{message:''}));
  autoUpdater.on('update-available',info=>{
    set('available',{version:info.version});
    {set("downloading",{percent:0});autoUpdater.downloadUpdate().catch(failed);}
  });
  autoUpdater.on('update-not-available',()=>set('current'));
  autoUpdater.on('download-progress',progress=>set('downloading',{percent:Math.round(progress.percent)}));
  autoUpdater.on('update-downloaded',info=>{
    set('ready',{version:info.version,deferred:deferredAtLaunch===info.version});
    if(deferredAtLaunch===info.version && !busy()) install().catch(failed);
  });
  const check=async()=>{
    if(!app.isPackaged) return status;
    if(checking || ['downloading','ready'].includes(status.state)) return status;
    checking=true;
    try {await autoUpdater.checkForUpdates();} catch(error){failed(error);}
    finally {checking=false;}
    return status;
  };
  handle('update-status',()=>status);
  handle('update-check',check);
  handle('update-download',async()=>{
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
