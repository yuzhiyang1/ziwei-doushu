'use client';
import {useEffect,useState} from 'react';
import {listStudyNotes,writeStudyNotes} from '@/lib/local-study-store';
import type {StudyNote} from '@/lib/local-study';
export default function StudyNoteEditor({id,onSaved}:{id:string;onSaved?:(note:StudyNote)=>void}){
 const [text,setText]=useState(''),[favorite,setFavorite]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(true);
 useEffect(()=>{let alive=true;setBusy(true);listStudyNotes().then(rows=>{if(alive){const row=rows.find(r=>r.id===id);setText(row?.note||'');setFavorite(row?.favorite||false);}}).catch(()=>{if(alive)setStatus('无法读取本地笔记');}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};},[id]);
 async function save(){if(busy)return;setBusy(true);try{const row={id,note:text,favorite,updatedAt:Date.now()};await writeStudyNotes([row]);setStatus('笔记已保存（仅本机）');onSaved?.(row);}catch(e){setStatus(e instanceof Error?e.message:'保存失败');}finally{setBusy(false);}}
 return <details><summary>个人收藏与笔记</summary><p>用户自记，不是倪师原话或古籍批注。只有点击保存才写入本机；取消会恢复已保存内容。</p><label><input aria-label="收藏此条" type="checkbox" checked={favorite} disabled={busy} onChange={e=>setFavorite(e.target.checked)}/> 收藏此条</label><label>个人笔记 <textarea aria-label="个人研读笔记" maxLength={10000} value={text} disabled={busy} onChange={e=>setText(e.target.value)}/></label><div className="local-toolbar"><button disabled={busy} onClick={save}>保存研读笔记</button><button disabled={busy} onClick={async()=>{setBusy(true);try{const row=(await listStudyNotes()).find(r=>r.id===id);setText(row?.note||'');setFavorite(row?.favorite||false);setStatus('已取消未保存修改');}catch{setStatus('无法恢复已保存笔记');}finally{setBusy(false);}}}>取消笔记修改</button></div><p role="status">{status}</p></details>;
}
