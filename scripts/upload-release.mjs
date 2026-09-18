import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {releasePlan} from './release-plan.mjs';

export async function uploadAsset(tag, file, run, wait = delay) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = run(['release', 'upload', tag, file, '--clobber']);
    if (!result.error && result.status === 0) return;
    if (attempt === 3) throw new Error(`Upload failed after 3 attempts: ${path.basename(file)}`);
    console.warn(`Retrying ${path.basename(file)} after failed upload (${attempt}/3)`);
    await wait(attempt * 15000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tag = process.env.GITHUB_REF_NAME;
  const {version} = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const plan = releasePlan(tag, version);
  const run = args => spawnSync('gh', args, {stdio:'inherit', timeout:300000});
  const view = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft'], {encoding:'utf8', timeout:30000});
  if (view.status !== 0 || !JSON.parse(view.stdout).isDraft) throw new Error('Uploads require an unpublished draft');
  const files = fs.readdirSync('release').filter(name => /\.(exe|dmg|zip|blockmap|yml)$/.test(name));
  const required = plan.assets.filter(name => process.platform === 'win32' ? !name.includes('-mac') : !name.includes('Setup') && name !== 'latest.yml');
  for (const name of required) if (!files.includes(name)) throw new Error(`Missing local asset: ${name}`);
  // Upload sequentially so a large ZIP failure retries only that asset.
  for (const name of files) await uploadAsset(tag, path.join('release', name), run);
}
