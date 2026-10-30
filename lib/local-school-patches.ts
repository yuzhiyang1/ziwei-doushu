/** Pure, per-chart school alternatives. Never mutates iztro's global configuration.
 * Sources: MIT repository school-tables.generated.ts; iztro 2.6.1
 * star/location.js (天马/天使天伤), star/decorativeStar.js (长生).
 * These are named calculation conventions, not validated predictions.
 */
import type { LocalSchoolConfig, SiHua, Star, ZiweiChart } from './ziwei/types';
import { SI_HUA_TABLE } from './ziwei/constants';
import { SCHOOL_AX } from './ziwei/school-tables.generated';
import { SCHOOL_STAR_ID_TO_NAME, schoolStarBrightness } from './ziwei/school-data';

export const LOCAL_SCHOOL_OPTIONS = {
  gengSihua: ['default', 'GYWTY', 'GYWFT', 'GYWFX', 'GYWTX'],
  tiankong: ['year', 'year-hour'],
  tianma: ['year', 'lunar-month'], jiekong: ['default', 'single', 'zhanyan'],
  kuiyue: ['default', 'table2', 'table3', 'table4'],
  tianshiTianshang: ['default', 'iztro-zhongzhou'], changsheng: ['default', 'water-earth', 'fire-earth'],
} as const;
/** Public modern 顺加生时 convention; not a reconstruction of any private service.
 * Sources/disambiguation: docs/TIANKONG_RULE.md. Branch/hour indexes: 子=0…亥=11.
 * Year 子 starts 丑; count that start as 子时 (zero extra steps), then move forward.
 */
export function tiankongBranch(yearBranch: number, hour: number, addBirthHour = false): number {
  if (![yearBranch, hour].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new Error('天空年支或时辰索引无效');
  return (yearBranch + 1 + (addBirthHour ? hour : 0)) % 12;
}
export function localSihuaByStem(stemIndex: number, config?: LocalSchoolConfig): { lu: string; quan: string; ke: string; ji: string } {
  let names = SI_HUA_TABLE[stemIndex];
  if (!names) throw new Error('四化天干索引无效');
  const variant = config?.gengSihua;
  if (stemIndex === 6 && variant && variant !== 'default') {
    names = SCHOOL_AX[`SHB_ARR_${variant}`].slice(1).map(id => SCHOOL_STAR_ID_TO_NAME[id]) as [string, string, string, string];
  }
  return { lu: names[0], quan: names[1], ke: names[2], ji: names[3] };
}
function starMap(stem: number, config: LocalSchoolConfig): Map<string, SiHua> {
  const v = localSihuaByStem(stem, config);
  return new Map([[v.lu, '禄'], [v.quan, '权'], [v.ke, '科'], [v.ji, '忌']]);
}
function relocate(chart: ZiweiChart, name: string, branch: number, config: LocalSchoolConfig) {
  const origin = chart.palaces.find(p => p.stars.some(s => s.name === name));
  const target = chart.palaces.find(p => p.branch === branch);
  if (!origin || !target) throw new Error(`缺少${name}或目标宫位，不能应用流派`);
  const moved = origin.stars.find(s => s.name === name)!;
  if (origin === target) return;
  origin.stars = origin.stars.filter(s => s !== moved);
  const b = schoolStarBrightness(name, branch, config.brightnessSchool === 'default' ? 'QS' : config.brightnessSchool);
  moved.brightnessRaw = b as Star['brightnessRaw'];
  moved.brightness = b ? (['庙', '旺'].includes(b) ? 'bright' : ['陷', '不', '闲'].includes(b) ? 'dim' : 'normal') : undefined;
  target.stars.push(moved);
}
export const LIFE_STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;
export function lifeStageBranches(ju: number, forward: boolean, fireEarth = false): number[] {
  const start = ({ 2: 8, 3: 11, 4: 5, 5: fireEarth ? 2 : 8, 6: 2 } as Record<number, number>)[ju];
  if (start === undefined) throw new Error('五行局无效');
  return LIFE_STAGES.map((_, i) => (start + (forward ? i : -i) + 12) % 12);
}
/** Operates on a newly generated chart, preserving byte-for-byte default palace output. */
export function applyLocalSchoolPatches(chart: ZiweiChart, config: LocalSchoolConfig): ZiweiChart {
  const stem = chart.lunarInfo.yearStem;
  if (config.tiankong === 'year-hour') relocate(chart, '天空', tiankongBranch(chart.lunarInfo.yearBranch, chart.birthInfo.hour, true), config);
  if (config.gengSihua && config.gengSihua !== 'default') {
    const natal = starMap(stem, config);
    for (const p of chart.palaces) {
      if (stem === 6) for (const s of p.stars) s.siHua = natal.get(s.name);
      // Do not re-enable fields deliberately absent in the engine's default output.
      if (p.selfSihua) {
        const self = starMap(p.stem, config);
        p.selfSihua = p.stars.filter(s => self.has(s.name)).map(s => ({ starName: s.name, siHua: self.get(s.name)! }));
      }
    }
    for (const dx of chart.daXians) if (dx.siHua) dx.siHua = { ...dx.siHua, ...localSihuaByStem(dx.siHua.stemIndex, config) };
  }
  if (config.tianma === 'lunar-month') {
    // Effective lunar month already includes selected leap-month policy. 正月=寅.
    const monthBranch = (Math.abs(chart.lunarInfo.lunarMonth) + 1) % 12;
    relocate(chart, '天马', [2, 11, 8, 5][monthBranch % 4], config);
  }
  if (config.jiekong === 'single' || config.jiekong === 'zhanyan') {
    const table = config.jiekong === 'single' ? SCHOOL_AX.JK_ARR1 : SCHOOL_AX.JK_ARR3;
    relocate(chart, '截空', table[stem + 1] - 1, config);
    // Only this named pair is affected. 旬空/副旬 remain unchanged.
    for (const p of chart.palaces) p.stars = p.stars.filter(s => s.name !== '副截');
  }
  if (config.kuiyue && config.kuiyue !== 'default') {
    const table = config.kuiyue === 'table2' ? SCHOOL_AX.KY_ARR2 : config.kuiyue === 'table3' ? SCHOOL_AX.KY_ARR3 : SCHOOL_AX.KY_ARR4;
    const pair = table[stem + 1];
    relocate(chart, '天魁', pair[0] - 1, config); relocate(chart, '天钺', pair[1] - 1, config);
  }
  if (config.tianshiTianshang === 'iztro-zhongzhou' && chart.lunarInfo.yearBranch % 2 !== (chart.birthInfo.gender === 'male' ? 0 : 1)) {
    const shi = chart.palaces.find(p => p.stars.some(s => s.name === '天使'))!;
    const shang = chart.palaces.find(p => p.stars.some(s => s.name === '天伤'))!;
    if (!shi || !shang) throw new Error('天使天伤缺失');
    const shiBranch = shi.branch, shangBranch = shang.branch;
    relocate(chart, '天使', shangBranch, config); relocate(chart, '天伤', shiBranch, config);
  }
  if (config.changsheng && config.changsheng !== 'default') {
    const forward = stem % 2 === (chart.birthInfo.gender === 'male' ? 0 : 1);
    lifeStageBranches(chart.wuxingJu, forward, config.changsheng === 'fire-earth').forEach((branch, i) => {
      chart.palaces.find(p => p.branch === branch)!.changsheng12 = LIFE_STAGES[i];
    });
  }
  return chart;
}
