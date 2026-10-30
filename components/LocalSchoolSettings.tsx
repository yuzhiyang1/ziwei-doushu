'use client';
import { useState } from 'react';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from '@/lib/local-chart';
import type { BirthInfo, LocalSchoolConfig, ZiweiChart } from '@/lib/ziwei/types';

export default function LocalSchoolSettings({ birth, onChange }: { birth: BirthInfo; onChange: (chart: ZiweiChart) => void }) {
  const [error, setError] = useState('');
  const config = birth.schoolConfig ?? LOCAL_SCHOOL_DEFAULTS;
  const canChangeClock = !!birth.origInput && !birth.birthTimeUnknown;
  function update<K extends keyof LocalSchoolConfig>(key: K, value: LocalSchoolConfig[K]) {
    try { const chart = generateLocalChart(birth, { ...config, [key]: value }); onChange(chart); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '流派重算失败'); }
  }
  return <details className="card-glass p-4 my-3"><summary>排盘口径（3 项已实现）</summary>
    <p className="text-xs my-2">变更立即重排；请重新保存档案，备份会携带这三个设置。未公开实现的其他流派项目不提供开关。亮度表不改变星曜位置，闰月规则仅影响闰月出生者。</p>
    <div className="grid gap-3">
      <label>星曜亮度表 <select aria-label="星曜亮度表" value={config.brightnessSchool} onChange={e => update('brightnessSchool', e.target.value as LocalSchoolConfig['brightnessSchool'])}>
        <option value="default">斗数全书（默认）</option><option value="XD1">现代修正 v1</option><option value="XD2">现代修正 v2</option><option value="ZZ">中州派</option>
      </select></label>
      <label>闰月归属 <select aria-label="闰月归属" value={config.leapMonth} onChange={e => update('leapMonth', e.target.value as LocalSchoolConfig['leapMonth'])}>
        <option value="split">前15天本月、后半月下月（默认）</option><option value="prev-month">整月视为本月</option><option value="next-month">整月视为下月</option><option value="origin-month">保持闰月</option>
      </select></label>
      <label>晚子时排盘日 <select aria-label="晚子时排盘日" disabled={!canChangeClock} value={config.lateZishi} onChange={e => update('lateZishi', e.target.value as LocalSchoolConfig['lateZishi'])}>
        <option value="next-day">23点后子时视为次日（默认）</option><option value="current-day">23点后子时视为当日</option>
      </select></label>
    </div>
    <p className="text-xs my-2">晚子时按真太阳时结果判断；这里只调整紫微排盘日，不提供独立的八字日柱/时柱流派切换。{!canChangeClock && '此档案缺少已知原始钟表时间，晚子时不可改；请重新录入。'}</p>
    {error && <p role="alert">{error}</p>}
  </details>;
}
