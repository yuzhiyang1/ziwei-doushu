import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url), seen=new Map();
const rows=(await readFile(new URL('docs/tianji-ziwei/entries.jsonl',root),'utf8')).trim().split('\n').map(line=>{const r=JSON.parse(line);if(!/^BV[A-Za-z0-9]+$/.test(r.bvid)||!Number.isInteger(r.part)||r.part<1||!/^\d{2}:\d{2}:\d{2}$/.test(r.t_hms)||typeof r.quote!=='string')throw Error('Invalid study source');const hash=createHash('sha256').update(JSON.stringify([r.bvid,r.part,r.t_hms,r.quote])).digest('hex').slice(0,20), n=seen.get(hash)||0;seen.set(hash,n+1);return {...r,id:`quote:${hash}:${n}`};});
await mkdir(new URL('public/',root),{recursive:true});
await writeFile(new URL('public/study-corpus.json',root),JSON.stringify({version:1,source:'Renhuai123/nihai-tianji-corpus@462faa4',license:'CC BY-NC-SA 4.0',entries:rows}));console.log(`Study corpus: ${rows.length} short excerpts; no video or full transcript`);
