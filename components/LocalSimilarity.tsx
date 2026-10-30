'use client';
import { useEffect, useRef, useState } from 'react';
import { generateLocalChart } from '@/lib/local-chart';
import { listProfiles } from '@/lib/local-store';
import type { ZiweiChart } from '@/lib/ziwei/types';
export function chartSimilarity(a: ZiweiChart,b: ZiweiChart) {
 const keys=(c:ZiweiChart)=>new Set(c.palaces.flatMap(p=>p.stars.filter(s=>s.type==='major').map(s=>`${p.name}:${s.name}`)));
 const x=keys(a),y=keys(b); const common=[...x].filter(v=>y.has(v)); const total=new Set([...x,...y]).size;
 return {score:total?Math.round(common.length/total*100):0,common};
}
export default function LocalSimilarity({chart}:{chart:ZiweiChart}) {
 const [scope,setScope]=useState<'all'|'same-year'|'cross-year'>('all'); const generation=useRef(0);
 const [results,setResults]=useState<{year:number;name:string;score:number;common:string[];unknown:boolean}[]>([]); const [status,setStatus]=useState('');
 const search=async()=>{const id=++generation.current;try {const profiles=await listProfiles(); const rows=profiles.map(p=>({year:p.birth.year,name:p.birth.name||'未命名档案',unknown:!!(p.birth.birthTimeUnknown||chart.birthInfo.birthTimeUnknown),...chartSimilarity(chart,generateLocalChart(p.birth))})).filter(r=>scope==='all'||(scope==='same-year')===(r.year===chart.birthInfo.year)).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));if(id!==generation.current)return;setResults(rows);setStatus(rows.length?'':'暂无档案，请先保存其他命盘。');}catch(e){if(id!==generation.current)return;setStatus(e instanceof Error?e.message:'读取失败');}};
 useEffect(()=>{generation.current++;setResults([]);setStatus('');return()=>{generation.current++;};},[chart,scope]);
 return <section className="local-card"><h2>相似命盘 · 本地档案</h2><p>仅比较你保存的档案。指标为“宫名:主星”集合的 Jaccard 重合度，不是人生相似概率，也不是官网大样本匹配。</p><label>档案年份范围 <select aria-label="档案年份范围" value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="all">全部</option><option value="same-year">同公历排盘年</option><option value="cross-year">跨公历排盘年</option></select></label><p>档案按各自已保存的流派配置比较；分类按当前各盘公历年，不按生肖。100%只表示这组主星特征相同，不是整盘一致。</p><button onClick={search}>搜索本地相似盘</button><p role="status">{status}</p>{results.map((r,i)=><details key={i}><summary>{r.name} · 结构重合 {r.score}% {r.unknown?'（含未知时辰，仅子时示例）':''}</summary><p>{r.year===chart.birthInfo.year?'同公历排盘年':'跨公历排盘年'} · {r.year}年</p><p>{r.common.join('、')||'无相同宫位主星'}</p></details>)}</section>;
}
