import { localSihuaByStem } from './local-school-patches';
import { astro } from 'iztro';
import { Solar } from 'lunar-javascript';
import { resolveEffectiveLunarDate, type LunarMonthPolicy } from './ziwei/algorithm';
import { BRANCHES, PALACE_NAMES_ORDER, SI_HUA_TABLE, STEMS } from './ziwei/constants';
import { DEFAULT_LEAP_MONTH } from './ziwei/school-config';
import { getDaXianIndexForYear } from './ziwei/yunxian-context';
import type { LocalSchoolConfig, ZiweiChart } from './ziwei/types';

export type TimeView = 'mingpan' | 'daxian' | 'liunian' | 'liuyue' | 'liuri' | 'liushi';
export interface TimeSelection { view: TimeView; date: string; hour: number; daXianIndex: number }
export const TIME_LABELS: Record<TimeView, string> = { mingpan: '本命', daxian: '大限', liunian: '流年', liuyue: '流月', liuri: '流日', liushi: '时辰' };
export function defaultTimeSelection(chart?: ZiweiChart): TimeSelection {
  const now = new Date();
  return { view: 'mingpan', date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, hour: Math.floor((now.getHours()+1)/2)%12, daXianIndex: Math.max(0, chart?.currentDaXianIndex ?? 0) };
}
export function parseTimeDate(date: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('请选择有效公历日期');
  const [y,m,d] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(y,m-1,d));
  if(y<1900 || y>2100 || probe.getUTCFullYear()!==y || probe.getUTCMonth()!==m-1 || probe.getUTCDate()!==d) throw new Error('日期需真实存在且在1900–2100年内');
  return [y,m,d];
}
export function getYearStemIndex(year: number): number { return ((year-4)%10+10)%10; }
export function buildSiHuaOverlay(stem: number,config?:LocalSchoolConfig): Record<string,string> {
  const hua=localSihuaByStem(stem,config);
  const stars=[hua.lu,hua.quan,hua.ke,hua.ji];
  return stars ? Object.fromEntries(stars.map((s,i)=>[s,['禄','权','科','忌'][i]])) : {};
}
export interface TimeContext {
  label: string; description: string; overlay: Record<string,string>;
  palaceNames: Record<number,string>; transitStars: Record<number,string[]>;
  mingBranch?: number; effectiveDaXianIndex: number;
}
/** Uses iztro's horoscope API; branch mapping is 寅=0 in iztro, 子=0 in this app.
 * See https://iztro.com/posts/horoscope . Natal stars are never mutated. */
export function resolveTimeContext(chart: ZiweiChart, selection: TimeSelection): TimeContext {
  const [year,month,day]=parseTimeDate(selection.date);
  if(!Number.isInteger(selection.hour)||selection.hour<0||selection.hour>11) throw new Error('时辰必须为0–11');
  const base: TimeContext={label:TIME_LABELS[selection.view], description:'本命盘；传统术数文化研究，不代表事实预测。',overlay:{},palaceNames:{},transitStars:{},effectiveDaXianIndex:-1};
  if(selection.view==='mingpan') return base;
  if(selection.view==='daxian') {
    const dx=chart.daXians[selection.daXianIndex];
    if(!dx) throw new Error('请选择有效大限');
    const palace=chart.palaces.find(p=>p.branch===dx.palaceBranch)!;
    base.overlay=buildSiHuaOverlay(palace.stem,chart.birthInfo.schoolConfig);
    base.mingBranch=palace.branch;
    base.effectiveDaXianIndex=selection.daXianIndex;
    for(let i=0;i<12;i++) base.palaceNames[(palace.branch-i+12)%12]=PALACE_NAMES_ORDER[i];
    base.description=`大限 ${dx.startAge}–${dx.endAge}虚岁，命宫在${BRANCHES[palace.branch]}，${STEMS[palace.stem]}干四化；以本命宫干为准。`;
    return base;
  }
  const b=chart.birthInfo;
  const policy=b.schoolConfig?.leapMonth ?? DEFAULT_LEAP_MONTH;
  const lunar=resolveEffectiveLunarDate(b.year,b.month,b.day,policy);
  const astrolabe=policy!=='split' && lunar.rawLunarMonth<0
    ? astro.byLunar(`${lunar.lunarYear}-${lunar.lunarMonth}-${lunar.lunarDay}`,b.hour,b.gender==='male'?'男':'女',lunar.isLeapMonth,false,'zh-CN')
    : astro.bySolar(`${b.year}-${b.month}-${b.day}`,b.hour,b.gender==='male'?'男':'女',true,'zh-CN');
  const horoscope=astrolabe.horoscope(`${year}-${month}-${day}`,selection.hour);
  const key=({liunian:'yearly',liuyue:'monthly',liuri:'daily',liushi:'hourly'} as const)[selection.view];
  const period=horoscope[key];
  base.mingBranch=(period.index+2)%12;
  period.palaceNames.forEach((name,i)=>{base.palaceNames[(i+2)%12]=name;});
  period.stars?.forEach((stars,i)=>{base.transitStars[(i+2)%12]=stars.map(s=>s.name);});
  // Keep the repository's established four-transformations table across all layers.
  base.overlay=buildSiHuaOverlay(STEMS.indexOf(period.heavenlyStem),chart.birthInfo.schoolConfig);
  const selectedLunar=Solar.fromYmd(year,month,day).getLunar();
  base.effectiveDaXianIndex=getDaXianIndexForYear(chart,selectedLunar.getYear());
  base.description=`${base.label}：公历${selection.date} ${BRANCHES[selection.hour]}时；农历${selectedLunar.getYear()}年${selectedLunar.getMonth()}月${selectedLunar.getDay()}日；${period.heavenlyStem}${period.earthlyBranch}，运限命宫在${BRANCHES[base.mingBranch]}。运限宫位/流曜来自iztro，四化沿用本仓库表；日期为所选公历日，不把公历年误作农历流年。`;
  return base;
}
