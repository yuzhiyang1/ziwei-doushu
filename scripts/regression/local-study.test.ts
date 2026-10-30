import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import 'fake-indexeddb/auto';
import {filterStudy,lectureLabel,videoSeconds,videoURL,parseStudyBackup,serializeStudyBackup,validateStudyNote, type StudyEntry} from '../../lib/local-study';
import {listStudyNotes,writeStudyNotes} from '../../lib/local-study-store';
async function main(){
 const corpus=JSON.parse(readFileSync('public/study-corpus.json','utf8')),rows:StudyEntry[]=corpus.entries;
 assert.equal(rows.length,1848);assert.equal(new Set(rows.map(r=>r.id)).size,1848);
 assert.equal(lectureLabel(3),'2上');assert.equal(lectureLabel(48),'24下');assert.equal(videoSeconds('00:36:09'),2169);assert.throws(()=>videoSeconds('00:60:00'));
 for(const row of rows){assert.match(videoURL(row),/^https:\/\/www.bilibili.com\/video\/BV\w+\?p=\d+&t=\d+$/);assert.ok(videoSeconds(row.t_hms)>=0);}
 assert.equal(filterStudy(rows,'','3').length,180);assert.equal(filterStudy(rows,'','48').length,11);assert.equal(filterStudy(rows,'','','01-stars').length,378);assert.equal(filterStudy(rows,'不存在的QA字符串').length,0);assert.equal(filterStudy(rows,'','','',new Set([rows[0].id])).length,1);
 const one={id:rows[0].id,note:'QA笔记 <script>非HTML</script>',favorite:true,updatedAt:1};const two={id:'classic:qs-1-1',note:'个人笔记非原著',favorite:false,updatedAt:2};
 assert.deepEqual(parseStudyBackup(serializeStudyBackup([one,two])),[one,two]);assert.throws(()=>parseStudyBackup('{invalid'));assert.throws(()=>parseStudyBackup(JSON.stringify({format:'wrong',notes:[]})));assert.throws(()=>parseStudyBackup(JSON.stringify({format:'ziwei-study-v1',notes:[one,one]})));assert.throws(()=>validateStudyNote({...one,note:'a'.repeat(10001)}));assert.throws(()=>validateStudyNote({...one,id:'https://evil.invalid'}));assert.throws(()=>parseStudyBackup(' '.repeat(2*1024*1024+1)));
 await writeStudyNotes([one]);assert.deepEqual(await listStudyNotes(),[one]);
 const ac=new AbortController();ac.abort();await assert.rejects(writeStudyNotes([two],ac.signal),{name:'AbortError'});assert.deepEqual(await listStudyNotes(),[one]);
 await assert.rejects(writeStudyNotes([two,{...one,note:'x'.repeat(10001)}]));assert.deepEqual(await listStudyNotes(),[one]);
 await writeStudyNotes([two,{...one,note:'restored'}]);assert.equal((await listStudyNotes()).length,2);assert.equal((await listStudyNotes()).find(r=>r.id===one.id)?.note,'restored');
 // A canceled preview is simply parsed and discarded: parsing must never write.
 parseStudyBackup(serializeStudyBackup([{...one,note:'not committed'}]));assert.equal((await listStudyNotes()).find(r=>r.id===one.id)?.note,'restored');

 // Each import is individually valid, but merged storage must always remain exportable.
 const chunk=(prefix:string)=>Array.from({length:110},(_,i)=>({id:`classic:${prefix}-${i}`,note:'x'.repeat(10000),favorite:false,updatedAt:3}));
 const first=chunk('budget-a'),second=chunk('budget-b');
 parseStudyBackup(serializeStudyBackup(first));parseStudyBackup(serializeStudyBackup(second));
 await writeStudyNotes(first);const beforeOverflow=await listStudyNotes();
 await assert.rejects(writeStudyNotes(second),/2MB/);
 assert.deepEqual(await listStudyNotes(),beforeOverflow,'merged byte overflow must preserve every previous row');
 parseStudyBackup(serializeStudyBackup(await listStudyNotes()));
 // Ordinary single-note editing can exceed the aggregate too; enforce the same transaction path.
 const bulk=Array.from({length:4888},(_,i)=>({id:`classic:count-${i}`,note:'',favorite:false,updatedAt:4}));
 await writeStudyNotes(bulk);const atLimit=await listStudyNotes();assert.equal(atLimit.length,5000);
 await assert.rejects(writeStudyNotes([{id:'classic:count-over',note:'one',favorite:true,updatedAt:5}]),/5000条/);
 assert.deepEqual(await listStudyNotes(),atLimit,'count overflow must preserve the old database');
 // Replacing an existing row at the limit remains allowed and exportable.
 await writeStudyNotes([{...one,note:'updated at limit'}]);
 assert.equal((await listStudyNotes()).length,5000);parseStudyBackup(serializeStudyBackup(await listStudyNotes()));
 assert.ok(!serializeStudyBackup([one]).includes('apiKey'));console.log('PASS study: 1848 unique excerpts, validated second-links, filters, backup limits/roundtrip, IndexedDB persistence, canceled/invalid atomic imports; no external video or model tested');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
