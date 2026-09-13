import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {resolveEnvironment, acceptsUpdate} from '../src/desktop/environment.cjs';
import {configureProfile} from '../src/desktop/profile.cjs';
import {releasePlan, verifyRelease} from '../scripts/release-plan.mjs';
const require = createRequire(import.meta.url);

test('packaged identity ignores launch overrides and development defaults are explicit', () => {
  assert.equal(resolveEnvironment({isPackaged:false}).environment, 'development');
  assert.equal(resolveEnvironment({isPackaged:false,argv:['--dev']}).liveReload, true);
  assert.equal(resolveEnvironment({isPackaged:false,argv:['--environment=other','--dev']}).environment, 'development');
  assert.equal(resolveEnvironment({isPackaged:true,argv:['--environment=other']}).environment, 'production');
  assert.throws(() => resolveEnvironment({isPackaged:true,metadata:{appEnvironment:'unknown'}}), /Invalid/);
  assert.equal(resolveEnvironment({isPackaged:false,argv:['--environment=production']}).environment, 'development');
});

test('source and installed environments isolate storage while preserving production data', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shelf-environments-'));
  t.after(() => fs.rm(root,{recursive:true,force:true}));
  const dirs = [];
  for (const [environment,isPackaged] of [['development',false],['production',true]]) {
    const paths={appData:root,userData:path.join(root,'season-shelf')};
    const app={isPackaged,getPath:key=>paths[key],setPath:(key,value)=>paths[key]=value};
    const dir=configureProfile(app,environment);
    assert.equal(paths.sessionData,dir);
    assert.equal(dirs.includes(dir),false);
    dirs.push(dir);
    await fs.writeFile(path.join(dir,'history'),'retained');
    configureProfile(app,environment);
    assert.equal(await fs.readFile(path.join(dir,'history'),'utf8'),'retained');
  }
  assert.equal(dirs[0],path.join(root,'season-shelf'));
  assert.equal(dirs.at(-1),path.join(root,'Season Shelf','installed'));
});

test('release channels reject cross-environment versions and incomplete assets', () => {
  assert.equal(acceptsUpdate('production','0.2.0-beta.1'),false);
  assert.equal(acceptsUpdate('development','0.2.0'),false);
  for (const version of ['0.2.0']) {
    const plan=releasePlan(`v${version}`,version);
    const release={isDraft:true,assets:plan.assets.map(name=>({name}))};
    verifyRelease(release,plan);
    assert.throws(()=>verifyRelease({...release,isDraft:false},plan),/draft/);
    assert.throws(()=>verifyRelease({...release,assets:release.assets.slice(1)},plan),/Missing/);
  }
  assert.throws(()=>releasePlan('v0.2.0','0.1.0'),/Tag/);
  assert.throws(()=>releasePlan('v0.2.0-beta.1','0.2.0-beta.1'),/Tag/);
});

test('production packaging validates configuration and refuses prerelease versions', async () => {
  const production=require('../package.json').build;
  const {validateConfiguration}=require('app-builder-lib/out/util/config/config');
  await validateConfiguration(production);
  const validate=require('../build/validate-environment.cjs');
  validate({packager:{config:production,appInfo:{version:'1.0.0'}}});
  assert.throws(()=>validate({packager:{config:production,appInfo:{version:'1.0.0-beta.1'}}}),/Production requires/);
});
