import { type StudyNote, validateStudyNote, serializeStudyBackup } from './local-study';
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{let failed=false;const req=indexedDB.open('ziwei-study-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('notes',{keyPath:'id'});req.onsuccess=()=>{if(failed){req.result.close();return;}req.result.onversionchange=()=>req.result.close();resolve(req.result);};req.onerror=()=>reject(req.error);req.onblocked=()=>{failed=true;reject(Error('研读数据库被其他页面阻塞，请关闭旧页面重试'));};});}
export async function listStudyNotes():Promise<StudyNote[]>{const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('notes','readonly'),req=tx.objectStore('notes').getAll();let rows:StudyNote[]=[];req.onsuccess=()=>rows=req.result;tx.oncomplete=()=>{db.close();resolve(rows);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||Error('读取笔记失败'));};});}
export async function writeStudyNotes(rows:StudyNote[],signal?:AbortSignal){
 const notes=rows.map(validateStudyNote);
 if(signal?.aborted)throw new DOMException('已取消','AbortError');
 const db=await openDB();
 if(signal?.aborted){db.close();throw new DOMException('已取消','AbortError');}
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('notes','readwrite'),store=tx.objectStore('notes');
  let validationError:Error|undefined;
  const abort=()=>{try{tx.abort();}catch{}};
  signal?.addEventListener('abort',abort,{once:true});
  const req=store.getAll();
  req.onsuccess=()=>{
   try {
    const merged=new Map<string,StudyNote>((req.result as StudyNote[]).map(row=>[row.id,row]));
    notes.forEach(row=>merged.set(row.id,row));
    // Validate the entire post-merge database before any write, under the same
    // readwrite transaction so concurrent saves cannot race around the budget.
    serializeStudyBackup([...merged.values()]);
    notes.forEach(row=>store.put(row));
   }catch(error){validationError=error instanceof Error?error:Error('研读笔记总量超出备份限制');tx.abort();}
  };
  const end=()=>{signal?.removeEventListener('abort',abort);db.close();};
  tx.oncomplete=()=>{end();resolve();};
  tx.onerror=tx.onabort=()=>{end();reject(signal?.aborted?new DOMException('已取消','AbortError'):validationError||tx.error||Error('保存笔记失败'));};
 });
}
