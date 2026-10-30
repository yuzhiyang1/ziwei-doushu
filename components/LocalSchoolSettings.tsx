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
  return <details className="card-glass p-4 my-3"><summary>排盘口径（9 项可配置）</summary>
    <p className="text-xs my-2">变更立即重排；请重新保存档案，备份会携带设置。天空“顺加生时”缺少完整公开公式，仍不提供开关。亮度表不改变星曜位置，闰月规则仅影响闰月出生者。</p>
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
      <label>庚年四化 <select aria-label="庚年四化" value={config.gengSihua ?? 'default'} onChange={e => update('gengSihua', e.target.value as LocalSchoolConfig['gengSihua'])}>
        <option value="default">太阳武曲太阴天同（默认）</option><option value="GYWTY">太阳武曲天同太阴</option><option value="GYWFT">太阳武曲天府天同</option><option value="GYWFX">太阳武曲天府天相</option><option value="GYWTX">太阳武曲天同天相</option>
      </select>（依次禄权科忌；也用于运限庚干）</label>
      <label>天马 <select aria-label="天马" value={config.tianma ?? 'year'} onChange={e => update('tianma', e.target.value as LocalSchoolConfig['tianma'])}>
        <option value="year">年支天马（默认）</option><option value="lunar-month">有效农历月天马（随闰月设置）</option>
      </select></label>
      <label>截空 <select aria-label="截空" value={config.jiekong ?? 'default'} onChange={e => update('jiekong', e.target.value as LocalSchoolConfig['jiekong'])}>
        <option value="default">原默认截空与副截</option><option value="single">仓库单星表 JK1（不显示副截）</option><option value="zhanyan">仓库占验表 JK3（不显示副截）</option>
      </select>（旬空、副旬不变）</label>
      <label>魁钺 <select aria-label="魁钺" value={config.kuiyue ?? 'default'} onChange={e => update('kuiyue', e.target.value as LocalSchoolConfig['kuiyue'])}>
        <option value="default">仓库 KY1（原默认）</option><option value="table2">仓库 KY2</option><option value="table3">仓库 KY3</option><option value="table4">仓库 KY4</option>
      </select></label>
      <label>天使天伤 <select aria-label="天使天伤" value={config.tianshiTianshang ?? 'default'} onChange={e => update('tianshiTianshang', e.target.value as LocalSchoolConfig['tianshiTianshang'])}>
        <option value="default">天使疾厄、天伤交友（默认）</option><option value="iztro-zhongzhou">iztro 中州：阴男阳女互换</option>
      </select>（按年支阴阳与性别，不按生月）</label>
      <label>长生十二神 <select aria-label="长生十二神" value={config.changsheng ?? 'default'} onChange={e => update('changsheng', e.target.value as LocalSchoolConfig['changsheng'])}>
        <option value="default">不显示（保持原默认盘）</option><option value="water-earth">显示水土同申（iztro 默认算法）</option><option value="fire-earth">显示火土同寅（土五局改寅）</option>
      </select>（阳男阴女顺，阴男阳女逆；不显示与水土同申仅显示差异）</label>
    </div>
    <p className="text-xs my-2">晚子时按真太阳时结果判断；这里只调整紫微排盘日，不提供独立的八字日柱/时柱流派切换。{!canChangeClock && '此档案缺少已知原始钟表时间，晚子时不可改；请重新录入。'}</p>
    {error && <p role="alert">{error}</p>}
  </details>;
}
