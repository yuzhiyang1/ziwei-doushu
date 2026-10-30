import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS, validateLocalSchoolConfig } from '../../lib/local-chart';
import { resolveLocalBirth } from '../../lib/local-birth';
import { tiankongBranch } from '../../lib/local-school-patches';
import { schoolStarBrightness } from '../../lib/ziwei/school-data';
import { chartId, deleteProfile, exportBackup, importBackup, listProfiles, loadChat, saveChat, saveProfile, validateBirth } from '../../lib/local-store';
import type { LocalSchoolConfig, ZiweiChart } from '../../lib/ziwei/types';

// Independent literal palace-walk oracle for the public modern 顺加生时 convention.
// Year 子 starts 丑, and that starting palace is counted as 子时 (zero steps).
// This is a public rule test, not an assertion about any private service's algorithm.
const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const nextPalace: Record<string, string> = { 子: '丑', 丑: '寅', 寅: '卯', 卯: '辰', 辰: '巳', 巳: '午', 午: '未', 未: '申', 申: '酉', 酉: '戌', 戌: '亥', 亥: '子' };
function walkOracle(yearBranch: number, birthHour: number, addHour: boolean): number {
  let palace = nextPalace[branches[yearBranch]];
  if (addHour) for (let step = 0; step < birthHour; step++) palace = nextPalace[palace];
  return branches.indexOf(palace);
}
const position = (chart: ZiweiChart, name: string) => chart.palaces.find(p => p.stars.some(s => s.name === name))?.branch;
const withoutSky = (chart: ZiweiChart) => chart.palaces.map(p => ({ ...p, stars: p.stars.filter(s => s.name !== '天空') }));
const alternative: LocalSchoolConfig = { ...LOCAL_SCHOOL_DEFAULTS, tiankong: 'year-hour' };
const base = { year: 1984, month: 6, day: 15, hour: 6, gender: 'male' as const };

async function main() {
  assert.equal(tiankongBranch(0, 6, true), 7, '子年午时必须落未，而不是午/申');
  assert.equal(tiankongBranch(0, 0, true), 1, '子时是零步，不额外加一');
  assert.equal(tiankongBranch(0, 11, true), 0, '从丑顺走亥时11步绕回子');
  assert.equal(tiankongBranch(11, 0, true), 0, '亥年起子');
  for (const [year, hour] of [[-1, 0], [12, 0], [0, -1], [0, 12], [0.5, 0], [0, NaN]]) assert.throws(() => tiankongBranch(year, hour, true));
  assert.deepEqual(validateLocalSchoolConfig({ ...LOCAL_SCHOOL_DEFAULTS, tiankong: 'year' }), LOCAL_SCHOOL_DEFAULTS, 'explicit year is canonical default');
  assert.throws(() => validateLocalSchoolConfig({ ...LOCAL_SCHOOL_DEFAULTS, tiankong: 'private-algorithm' }));
  for (let yearBranch = 0; yearBranch < 12; yearBranch++) for (let hour = 0; hour < 12; hour++) for (const gender of ['male', 'female'] as const) {
    const birth = { ...base, year: 1984 + yearBranch, hour, gender };
    const original = generateLocalChart(birth);
    const moved = generateLocalChart(birth, alternative);
    assert.equal(original.lunarInfo.yearBranch, yearBranch);
    assert.equal(tiankongBranch(yearBranch, hour), walkOracle(yearBranch, hour, false));
    assert.equal(tiankongBranch(yearBranch, hour, true), walkOracle(yearBranch, hour, true));
    assert.equal(position(original, '天空'), walkOracle(yearBranch, hour, false));
    assert.equal(position(moved, '天空'), walkOracle(yearBranch, hour, true));
    assert.equal(moved.palaces.flatMap(p => p.stars).filter(s => s.name === '天空').length, 1);
    assert.deepEqual(withoutSky(moved), withoutSky(original), 'only 天空 may change, no unrelated stars or palace data');
    for (const name of ['地空', '旬空', '副旬', '截空', '副截']) assert.equal(position(moved, name), position(original, name), `${name} must not be conflated with 天空`);
    assert.deepEqual(generateLocalChart(moved.birthInfo), moved, 'saved option reproduces exactly');
    assert.deepEqual(generateLocalChart(moved.birthInfo, { ...LOCAL_SCHOOL_DEFAULTS }).palaces, original.palaces, 'reset does not retain relocated star');
    assert.deepEqual(generateChart(birth, { leapMonth: 'split' }).palaces, original.palaces, 'default engine stays unchanged');
  }
  for (let hour = 0; hour < 12; hour++) {
    const chart = generateLocalChart({ ...base, hour }, { ...alternative, brightnessSchool: 'ZZ' });
    const palace = chart.palaces.find(p => p.stars.some(s => s.name === '天空'))!;
    const star = palace.stars.find(s => s.name === '天空')!;
    const brightness = schoolStarBrightness('天空', palace.branch, 'ZZ');
    assert.equal(star.brightnessRaw, brightness, 'relocation recomputes selected ZZ brightness at destination');
    assert.equal(star.brightness, brightness ? (['庙', '旺'].includes(brightness) ? 'bright' : ['陷', '不', '闲'].includes(brightness) ? 'dim' : 'normal') : undefined);
  }
  // Lunar new year, not Gregorian Jan 1 or an unadjusted year-number formula.
  const beforeNewYear = generateLocalChart({ ...base, month: 2, day: 1 }, alternative);
  const afterNewYear = generateLocalChart({ ...base, month: 2, day: 2 }, alternative);
  assert.equal(beforeNewYear.lunarInfo.yearBranch, 11);
  assert.equal(afterNewYear.lunarInfo.yearBranch, 0);
  assert.equal(position(beforeNewYear, '天空'), 6);
  assert.equal(position(afterNewYear, '天空'), 7);
  const raw = { year: '1984', month: '2', day: '1', clockHour: '23', clockMinute: '50', unknownTime: false, longitude: 120, province: '', city: '', gender: 'male' as const, name: '' };
  const resolved = resolveLocalBirth(raw);
  const lateNext = generateLocalChart(resolved, alternative);
  const lateCurrent = generateLocalChart(resolved, { ...alternative, lateZishi: 'current-day' });
  assert.equal(lateNext.birthInfo.day, 2); assert.equal(lateNext.birthInfo.hour, 0);
  assert.equal(lateCurrent.birthInfo.day, 1); assert.equal(lateCurrent.birthInfo.hour, 0);
  assert.equal(position(lateNext, '天空'), 1); assert.equal(position(lateCurrent, '天空'), 0);
  assert.deepEqual(generateLocalChart(lateCurrent.birthInfo), lateCurrent, 'late-zishi regeneration must not double-shift date');
  assert.deepEqual(generateLocalChart(lateCurrent.birthInfo, alternative), lateNext);
  const noon = { ...raw, year: '2000', month: '5', day: '15', clockHour: '12', clockMinute: '00', province: '测试地点' };
  const east = generateLocalChart(resolveLocalBirth({ ...noon, longitude: 120 }), alternative);
  const west = generateLocalChart(resolveLocalBirth({ ...noon, longitude: 75 }), alternative);
  assert.notEqual(west.birthInfo.hour, east.birthInfo.hour, 'longitude correction changes the effective birth hour');
  for (const chart of [east, west]) assert.equal(position(chart, '天空'), walkOracle(chart.lunarInfo.yearBranch, chart.birthInfo.hour, true), '天空 uses corrected hour, not raw clock');
  assert.deepEqual(generateLocalChart(west.birthInfo), west, 'true-solar regeneration is idempotent');
  const unknown = generateLocalChart(resolveLocalBirth({ ...raw, unknownTime: true }), alternative);
  assert.equal(unknown.birthInfo.birthTimeUnknown, true);
  assert.equal(position(unknown, '天空'), walkOracle(unknown.lunarInfo.yearBranch, 0, true), 'unknown time remains a marked 子时 example');

  const original = generateLocalChart(base), configured = generateLocalChart(base, alternative);
  assert.equal(validateBirth(configured.birthInfo).schoolConfig?.tiankong, 'year-hour');
  assert.notEqual(chartId(configured), chartId(original), 'different school options isolate chat identity');
  assert.equal(chartId(generateLocalChart(base, { ...LOCAL_SCHOOL_DEFAULTS, tiankong: 'year' })), chartId(original), 'explicit default has same canonical identity');
  await saveProfile(configured.birthInfo);
  await saveChat(configured, [{ role: 'user', content: '天空顺加生时测试' }]);
  assert.equal((await loadChat(original)).length, 0);
  const backup = await exportBackup();
  assert.match(backup, /year-hour/);
  const saved = (await listProfiles())[0]; await deleteProfile(saved.id); await saveChat(configured, []);
  await importBackup(backup);
  const restored = (await listProfiles())[0];
  assert.equal(restored.birth.schoolConfig?.tiankong, 'year-hour');
  assert.deepEqual(generateLocalChart(restored.birth), configured);
  assert.equal((await loadChat(configured))[0].content, '天空顺加生时测试');
  assert.equal((await loadChat(original)).length, 0);
  console.log('PASS public 天空 palace-walk oracle: 12 year branches × 12 hours × 2 genders; defaults/other stars unchanged; ZZ brightness; lunar new year/solar/late-zishi; archive-backup/chat identity');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
