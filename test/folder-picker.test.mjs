import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {folderPickerStart} from '../src/desktop/folder-picker.mjs';

test('folder picker resumes each mode at its saved show folder across serialized settings',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-picker-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const archive=path.join(root,'Download','From'),watch=path.join(root,'Watch','From');
  await fs.mkdir(archive,{recursive:true});await fs.mkdir(watch,{recursive:true});
  const settings=JSON.parse(JSON.stringify({archiveRoot:{path:archive},watchRoot:{path:watch}}));
  assert.equal(await folderPickerStart(settings,'archive'),archive);
  assert.equal(await folderPickerStart(settings,'watch'),watch);
  assert.equal(await folderPickerStart({archiveRoot:settings.archiveRoot},'watch'),archive);
  const next=path.join(root,'Download','Another show');await fs.mkdir(next);
  settings.archiveRoot={path:next};
  assert.equal(await folderPickerStart(settings,'archive'),next);
});

test('a removed folder starts at the nearest existing parent without recreating it',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-picker-missing-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const removed=path.join(root,'Show','Season 01');
  assert.equal(await folderPickerStart({archiveRoot:{path:removed}},'archive'),root);
  await assert.rejects(fs.stat(removed),{code:'ENOENT'});
  assert.equal(await folderPickerStart({},'archive'),undefined);
  assert.equal(await folderPickerStart({archiveRoot:{path:'relative/folder'}},'archive'),undefined);
});
