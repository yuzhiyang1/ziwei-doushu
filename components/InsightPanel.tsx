'use client';
import { useState, useEffect } from 'react';
import { buildPeriodAnalysis, analyzePeriodBranch } from '@/lib/local-period-analysis';
import type { TimeSelection, TimeContext } from '@/lib/local-time';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import { LOCAL_ANALYSIS_NOTICE } from '@/lib/local-analysis';

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: { starName: string; siHua: string; view: string } | null;
  selection: TimeSelection;
  timeContext: TimeContext;
}
export default function InsightPanel({ chart, selectedPalace, selectedSiHua, timeContext, selection }: InsightPanelProps) {
  const [topic, setTopic] = useState('overview');
  const [showSelected, setShowSelected] = useState(true);
  useEffect(() => { setShowSelected(true); }, [selectedPalace]);
  const sections = buildPeriodAnalysis(chart, selection, timeContext);
  const section = sections.find(s => s.id === topic) ?? sections[0];
  const chosen = selectedPalace && showSelected ? analyzePeriodBranch(chart, selectedPalace.branch, selection, timeContext) : null;
  const active = chosen ?? section;
  return <section className="card-glass rounded-xl p-4 space-y-4" aria-label="本地十三维解读">
    <h2 className="text-lg font-semibold">十三维本地解读</h2>
    <p className="text-xs leading-relaxed">{LOCAL_ANALYSIS_NOTICE}</p><p className="text-xs" role="note">当前所选层的十三维结构证据：叠宫、三方四正、四化与流曜，不是事件预测；只分析单选层，不冒充多层综合推断。当前图盘时序：{timeContext.description}</p>
    <div className="flex flex-wrap gap-2">{sections.map(s => <button type="button" key={s.id} aria-pressed={!chosen && topic === s.id} className="border rounded px-2 py-1 text-sm" onClick={() => { setTopic(s.id); setShowSelected(false); }}>{s.title.split(' · ')[0]}</button>)}</div>
    {selectedPalace && <button type="button" className="underline text-sm" onClick={() => setShowSelected(v => !v)}>{showSelected ? '关闭选中宫位解读' : `查看选中 ${selectedPalace.name}`}</button>}
    <article aria-live="polite" className="space-y-3">
      <h3 className="font-semibold">{active.title}</h3>
      <ul className="space-y-2 text-sm">{active.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
      <p className="text-sm leading-relaxed">{active.interpretation}</p>
      <p className="text-sm">思考：{active.questions.join(' ')}</p>
      {active.sourceQuery && <a className="underline text-sm" href={`/library/search?q=${encodeURIComponent(active.sourceQuery)}`}>查询摘编中的“{active.sourceQuery}”（待校勘摘编，不是上述自研说明的直接出处）</a>}
    </article>
    {selectedSiHua && <p className="text-sm">选中四化：{selectedSiHua.starName}化{selectedSiHua.siHua}；请结合图盘所示时序阅读，不与生年四化混同。</p>}
  </section>;
}
