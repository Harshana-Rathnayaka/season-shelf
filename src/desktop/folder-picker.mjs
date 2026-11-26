import fs from 'node:fs/promises';
import path from 'node:path';

// Electron otherwise falls back to the platform's default directory. Saved
// destination roots survive restarts; a removed folder can use its parent.
export async function folderPickerStart(settings, mode) {
  const keys=mode==='archive'?['archiveRoot','watchRoot']:['watchRoot','archiveRoot'];
  for(const key of keys) {
    let candidate=settings[key]?.path;
    if(typeof candidate!=='string' || !path.isAbsolute(candidate))continue;
    for(;;) {
      try {if((await fs.stat(candidate)).isDirectory())return candidate;}
      catch(error) {if(!['ENOENT','ENOTDIR'].includes(error.code))break;}
      const parent=path.dirname(candidate);
      if(parent===candidate)break;
      candidate=parent;
    }
  }
  return undefined;
}
