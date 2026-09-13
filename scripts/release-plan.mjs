import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function releasePlan(tag, version) {
  if (tag !== `v${version}` || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Tag must match package.json: a stable X.Y.Z version');
  }
  const prefix = 'Season-Shelf';
  const channel = 'latest';
  return {assets: [`${prefix}-Setup-${version}-x64.exe`, `${prefix}-Setup-${version}-x64.exe.blockmap`, `${channel}.yml`,
      `${prefix}-${version}-mac-universal.dmg`, `${prefix}-${version}-mac-universal.zip`, `${channel}-mac.yml`]};
}

export function verifyRelease(release, plan) {
  if (!release.isDraft) throw new Error('Expected an unpublished draft');
  const names = new Set(release.assets.map(asset => asset.name));
  for (const name of plan.assets) if (!names.has(name)) throw new Error(`Missing release asset: ${name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {version} = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const plan = releasePlan(process.env.GITHUB_REF_NAME, version);
  if (process.argv[2] === 'prepare') {
    console.log(`Validated release ${version}`);
  } else if (process.argv[2] === 'verify') {
    verifyRelease(JSON.parse(fs.readFileSync('release-state.json', 'utf8')), plan);
  } else throw new Error('Expected prepare or verify');
}
