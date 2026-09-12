import fs from 'node:fs/promises';
const labels=JSON.parse(await fs.readFile(new URL('../.github/labels.json',import.meta.url),'utf8'));
for(const item of labels) if(!item.name || !/^[a-f0-9]{6}$/i.test(item.color) || !item.description) throw new Error('Invalid label definition');
if(process.argv.includes('--check')) {console.log(`${labels.length} valid labels`);process.exit(0);}
const repository=process.env.GITHUB_REPOSITORY;
if(!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !process.env.GITHUB_TOKEN) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
const headers={Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
const base=`https://api.github.com/repos/${repository}/labels`;
for(const label of labels) {
  const existing=await fetch(`${base}/${encodeURIComponent(label.name)}`,{headers});
  if(!existing.ok && existing.status!==404) throw new Error(`Label lookup failed: ${existing.status}`);
  const response=await fetch(existing.ok?`${base}/${encodeURIComponent(label.name)}`:base,{method:existing.ok?'PATCH':'POST',headers,body:JSON.stringify(label)});
  if(!response.ok) throw new Error(`Could not save ${label.name}: HTTP ${response.status}`);
  console.log(`${existing.ok?'Updated':'Created'} ${label.name}`);
}
