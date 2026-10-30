'use client';
import {useState,useEffect} from 'react';
import {buildPeriodAnalysis,analyzePeriodBranch} from '@/lib/local-period-analysis';
import {buildReadableAnalysis} from '@/lib/local-readable-analysis';
import type {TimeSelection,TimeContext} from '@/lib/local-time';
import {BRANCHES} from '@/lib/ziwei/constants';
import type {ZiweiChart,Palace} from '@/lib/ziwei/types';
interface Props {chart:ZiweiChart;selectedPalace?:Palace|null;selectedSiHua?:{starName:string;siHua:string;view:string}|null;selection:TimeSelection;timeContext:TimeContext;onAskAI?:()=>void}
export default function InsightPanel({chart,selectedPalace,selectedSiHua,selection,timeContext,onAskAI}:Props){
 const [topic,setTopic]=useState('overview'),[showSelected,setShowSelected]=useState(false);
 useEffect(()=>{setShowSelected(!!selectedPalace);},[selectedPalace]);
 const dx=chart.daXians[selection.daXianIndex];
 const selectedWhen=selection.view==='mingpan'?'本命':selection.view==='daxian'?`大限 ${dx?.startAge}–${dx?.endAge}虚岁`:`${timeContext.label} ${selection.date} · ${BRANCHES[selection.hour]}时`;
 const structures=buildPeriodAnalysis(chart,selection,timeContext),readings=buildReadableAnalysis(chart,selection,timeContext);
 const selected=selectedPalace&&showSelected?analyzePeriodBranch(chart,selectedPalace.branch,selection,timeContext):null;
 const active=readings.find(s=>s.id===(selected?.id??topic))??readings[0];
 const structure=structures.find(s=>s.id===active.id)??structures[0];
 return <section className="analysis-panel" aria-label="本地十三维解读">
  <header className="analysis-heading"><div><span className="eyebrow">YOUR CHART, EXPLAINED</span><h2>十三维命盘分析</h2></div><span className="status-pill">本地已生成 · 无需 Key</span></header>
  <p className="analysis-intro">先读特点与建议，再查看依据。下面内容按你的实际命盘生成，不需要导入数据或连接 AI。</p>
  <div className="topic-tabs" aria-label="分析主题">{readings.map(s=><button type="button" key={s.id} aria-pressed={s.id===active.id} onClick={()=>{setTopic(s.id);setShowSelected(false);}}>{s.title.split(' · ')[0]}</button>)}</div>
  {selected&&<button className="text-action" onClick={()=>{setShowSelected(false);setTopic('overview');}}>← 返回命盘总览</button>}
  <article className="reading-body" aria-live="polite" data-testid="readable-analysis">
   <span className="reading-layer">{selectedWhen} · {active.title}</span><h3>{active.headline}</h3>
   <p className="reading-summary" data-testid="reading-summary">{active.summary}</p>
   <div className="evidence-chips">{active.evidenceChips.map((chip,i)=><span key={i}>{chip}</span>)}</div>
   <div className="reading-columns"><section><h4><span className="reading-dot positive"/>可以发挥的特点</h4><ul>{active.strengths.map((line,i)=><li key={i}>{line}</li>)}</ul></section><section><h4><span className="reading-dot attention"/>需要留意的张力</h4><ul>{active.watchouts.map((line,i)=><li key={i}>{line}</li>)}</ul></section></div>
   <section className="reading-actions"><h4>怎么用在日常思考里</h4><ol>{active.suggestions.map((line,i)=><li key={i}>{line}</li>)}</ol></section>
   <p className="reading-source">{active.sourceNote} 传统文化视角，不作为人格定论或医疗、投资、关系决策依据。</p>
   <details className="reading-evidence"><summary>查看排盘依据与计算口径</summary><h4>{structure.title}</h4><ul>{structure.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul><p>{structure.interpretation}</p>{active.id!=='overview'&&structure.sourceQuery&&<a href={`/library/search?q=${encodeURIComponent(structure.sourceQuery)}`}>检索相关整理摘编（待校勘）</a>}</details>
  </article>
  {onAskAI&&<div className="analysis-followup"><div><strong>想继续问这张命盘？</strong><p>连接自己的模型，带着当前盘面继续深入讨论。</p></div><button onClick={onAskAI}>进入 AI 深问 →</button></div>}
  {selectedSiHua&&<p>选中四化：{selectedSiHua.starName}化{selectedSiHua.siHua}</p>}
 </section>;
}
