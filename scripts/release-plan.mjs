import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function releasePlan(tag, version) {
  if (tag !== `v${version}` || !/^\d+\.\d+\.\d+(-uat\.\d+)?$/.test(version)) {
    throw new Error('Tag must match package.json: X.Y.Z or X.Y.Z-uat.N');
  }
  const uat = version.includes('-uat.');
  const prefix = uat ? 'Season-Shelf-UAT' : 'Season-Shelf';
  const channel = uat ? 'uat' : 'latest';
  return {flavour: uat ? 'uat' : 'production', prefix: uat ? 'uat:' : '',
    appName: uat ? 'Season Shelf UAT' : 'Season Shelf', output: uat ? 'release/uat' : 'release',
    assets: [`${prefix}-Setup-${version}-x64.exe`, `${prefix}-Setup-${version}-x64.exe.blockmap`, `${channel}.yml`,
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
    fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(plan).filter(([key]) => key !== 'assets').map(([key,value]) => `${key}=${value}\n`).join(''));
  } else if (process.argv[2] === 'verify') {
    verifyRelease(JSON.parse(fs.readFileSync('release-state.json', 'utf8')), plan);
  } else throw new Error('Expected prepare or verify');
}
