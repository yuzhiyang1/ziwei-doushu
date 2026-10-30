'use client';
import { useState } from 'react';
import Link from 'next/link';
import StudyWorkspace from '@/components/StudyWorkspace';
import { TIANJI_MODULES } from '@/lib/nihai/tianji';
import { RENJI_MODULES } from '@/lib/nihai/renji';
import { DIJI_MODULES } from '@/lib/nihai/diji';
const modules = [...TIANJI_MODULES,...DIJI_MODULES,...RENJI_MODULES];
export default function Study() {
 const [query,setQuery]=useState(''); const [category,setCategory]=useState('all');
 const selected=modules.filter(m=>(category==='all'||m.category===category)&&JSON.stringify(m).includes(query.trim()));
 return <main className="local-shell"><Link href="/">← 研究室</Link><h1>三纪 · 公开资料研读</h1><p>来源：本仓库 lib/nihai 的公开学习提要。并非商业课程完整版或专属精解；原话目录另遵循 docs/tianji-ziwei/LICENSE.md（CC BY-NC-SA 4.0）。医药内容仅为历史资料，不提供诊疗指导。</p><StudyWorkspace/><h2>三纪公开提要目录（不是完整课程）</h2><div className="local-toolbar"><label>搜索提要 <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="关键词 / 判语" /></label><label>分类 <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">全部</option><option value="tianji">天纪</option><option value="diji">地纪</option><option value="renji">人纪</option></select></label></div><p aria-live="polite">{selected.length} 个模块；展开查看章节与参考书目</p>{selected.map(m=><details className="local-card" key={m.id}><summary>{m.name} · {m.subtitle} · {m.status==='active'?'公开提要':m.status==='preview'?'预览提要':'预告提要'}</summary><p>{m.description}</p>{m.details.map((p,i)=><p key={i}>{p}</p>)}{m.chapters.map(c=><section key={c.id}><h3>{c.title}</h3><p>{c.description}</p><ul>{c.keyPoints.map((p,i)=><li key={i}>{p}</li>)}</ul>{c.quotes?.map((q,i)=><blockquote key={i}>资料所载：“{q}”</blockquote>)}</section>)}<p>参考：{m.references.join('；')}</p></details>)}</main>;
}
