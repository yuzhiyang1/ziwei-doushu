'use client';
import { useState } from 'react';
import { BRANCHES } from '@/lib/ziwei/constants';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { defaultTimeSelection, parseTimeDate, resolveTimeContext, TIME_LABELS, type TimeSelection, type TimeView } from '@/lib/local-time';
export { getYearStemIndex, buildSiHuaOverlay } from '@/lib/local-time';
export type { TimeView } from '@/lib/local-time';
interface TimeNavProps {
  chart: ZiweiChart; selection?: TimeSelection; onSelectionChange?: (value: TimeSelection)=>void;
  view?: TimeView; liunianYear?: number; onViewChange?: (view:TimeView)=>void; onYearChange?: (year:number)=>void;
}
export default function TimeNav({chart,selection,onSelectionChange,view,liunianYear,onViewChange,onYearChange}:TimeNavProps) {
  const [dateError,setDateError]=useState('');
  const value=selection ?? {...defaultTimeSelection(chart),view:view ?? 'mingpan',date:`${liunianYear??new Date().getFullYear()}-07-01`};
  const update=(patch:Partial<TimeSelection>)=>{ const next={...value,...patch}; onSelectionChange?.(next); if(patch.view) onViewChange?.(patch.view); if(patch.date) onYearChange?.(Number(patch.date.slice(0,4))); };
  let description=''; try { description=resolveTimeContext(chart,value).description; } catch(e) {description=e instanceof Error?e.message:'无法计算运限';}
  return <section className="rounded-xl p-3 space-y-3" style={{background:'var(--t-surface)',border:'1px solid var(--t-border)'}} aria-label="时间导航">
    <div className="flex flex-wrap gap-2">{(Object.keys(TIME_LABELS) as TimeView[]).map(v=><button type="button" key={v} aria-pressed={value.view===v} onClick={()=>update({view:v})} className="rounded px-3 py-2 text-sm" style={{background:value.view===v?'rgba(212,168,67,.2)':'transparent'}}>{TIME_LABELS[v]}</button>)}</div>
    {value.view==='daxian' && <label className="block text-sm">选择大限 <select aria-label="选择大限" value={value.daXianIndex} onChange={e=>update({daXianIndex:Number(e.target.value)})}>{chart.daXians.map((dx,i)=><option key={i} value={i}>{dx.startAge}–{dx.endAge}虚岁 · {dx.palaceName}</option>)}</select></label>}
    {value.view!=='mingpan' && value.view!=='daxian' && <div className="flex flex-wrap gap-3 text-sm"><label>运限公历日期 <input aria-label="运限公历日期" type="date" min="1900-01-01" max="2100-12-31" value={value.date} onChange={e=>{try{parseTimeDate(e.target.value);setDateError('');update({date:e.target.value});}catch(err){setDateError(err instanceof Error?err.message:'无效日期');}}}/></label><label>运限时辰 <select aria-label="运限时辰" value={value.hour} onChange={e=>update({hour:Number(e.target.value)})}>{BRANCHES.map((b,i)=><option key={b} value={i}>{b}时</option>)}</select></label></div>}
    {dateError && <p role="alert" className="text-xs text-red-500">{dateError}（仍保留上次有效选择）</p>}
    <p className="text-xs leading-relaxed" data-testid="time-context">{description}</p>
  </section>;
}
