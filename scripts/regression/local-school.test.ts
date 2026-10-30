import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from '../../lib/local-chart';
import { resolveLocalBirth } from '../../lib/local-birth';
const raw = { year: '1990', month: '6', day: '15', clockHour: '23', clockMinute: '50', unknownTime: false, longitude: 120, province: '', city: '', gender: 'male' as const, name: '' };
const birth = resolveLocalBirth(raw);
const next = generateLocalChart(birth);
const current = generateLocalChart(next.birthInfo, { ...LOCAL_SCHOOL_DEFAULTS, lateZishi: 'current-day' });
assert.equal(next.birthInfo.day, 16);
assert.equal(current.birthInfo.day, 15);
assert.deepEqual(generateLocalChart(current.birthInfo), current);
assert.deepEqual(generateLocalChart(current.birthInfo, { ...LOCAL_SCHOOL_DEFAULTS }), next);
const base = { year: 1990, month: 6, day: 15, hour: 4, gender: 'male' as const };
const normal = generateChart(base);
const alternate = generateLocalChart(base, { ...LOCAL_SCHOOL_DEFAULTS, brightnessSchool: 'XD1' });
assert.notDeepEqual(alternate.palaces, normal.palaces);
assert.deepEqual(generateChart(base), normal, 'alternate brightness must not leak');
assert.throws(() => generateLocalChart({ ...base, month: 2, day: 31 }, { ...LOCAL_SCHOOL_DEFAULTS, brightnessSchool: 'XD2' }));
assert.deepEqual(generateChart(base), normal, 'failed generation must also restore default brightness');
assert.throws(() => generateLocalChart(base, { ...LOCAL_SCHOOL_DEFAULTS, lateZishi: 'current-day' }), /原始钟表时间/);
const leap = { ...base, year: 2020, month: 6, day: 10 };
const prior = generateLocalChart(leap, { ...LOCAL_SCHOOL_DEFAULTS, leapMonth: 'prev-month' });
const after = generateLocalChart(leap, { ...LOCAL_SCHOOL_DEFAULTS, leapMonth: 'next-month' });
assert.notDeepEqual(prior.palaces, after.palaces);
assert.deepEqual(generateLocalChart(prior.birthInfo), prior, 'saved policy restores exactly');
console.log('Local school: original-clock idempotence, late-zishi switching, brightness isolation, leap-month and archive restoration passed.');

// Expanded school contract: named public rules, defaults unchanged, no global state.
import { astro, star } from 'iztro';
import { validateLocalSchoolConfig } from '../../lib/local-chart';
import { applyLocalSchoolPatches, LIFE_STAGES, lifeStageBranches, localSihuaByStem } from '../../lib/local-school-patches';
import { SCHOOL_AX } from '../../lib/ziwei/school-tables.generated';
import { schoolStarBrightness } from '../../lib/ziwei/school-data';
import { BRANCHES, STEMS } from '../../lib/ziwei/constants';
import type { LocalSchoolConfig, ZiweiChart } from '../../lib/ziwei/types';
const position = (c: ZiweiChart, name: string) => c.palaces.find(p => p.stars.some(s => s.name === name))?.branch;
const defaults = { ...LOCAL_SCHOOL_DEFAULTS };
assert.deepEqual(generateLocalChart(base).palaces, generateChart(base, { leapMonth: 'split' }).palaces);
assert.deepEqual(validateLocalSchoolConfig({ ...defaults, gengSihua: 'default', tianma: 'year', jiekong: 'default', kuiyue: 'default', tianshiTianshang: 'default', changsheng: 'default' }), defaults);
for (const field of ['gengSihua', 'tianma', 'jiekong', 'kuiyue', 'tianshiTianshang', 'changsheng']) assert.throws(() => validateLocalSchoolConfig({ ...defaults, [field]: 'unsupported' }));
const gengVariants = {
  GYWTY: ['太阳', '武曲', '天同', '太阴'], GYWFT: ['太阳', '武曲', '天府', '天同'],
  GYWFX: ['太阳', '武曲', '天府', '天相'], GYWTX: ['太阳', '武曲', '天同', '天相'],
} as const;
for (const [variant, names] of Object.entries(gengVariants)) {
  const config = { ...defaults, gengSihua: variant as LocalSchoolConfig['gengSihua'] };
  const c = generateLocalChart(base, config);
  assert.deepEqual(Object.values(localSihuaByStem(6, config)), names);
  for (let stem = 0; stem < 10; stem++) if (stem !== 6) assert.deepEqual(localSihuaByStem(stem, config), localSihuaByStem(stem));
  const actual = c.palaces.flatMap(p => p.stars).filter(s => s.siHua);
  assert.equal(actual.length, 4);
  names.forEach((name, i) => assert.equal(actual.find(s => s.name === name)?.siHua, ['禄', '权', '科', '忌'][i]));
  // Independent engine oracle (test process only). Explicit restore: iztro merges configuration.
  try {
    astro.config({ mutagens: { 庚: [...names] } });
    const oracle = astro.bySolar('1990-6-15', 4, '男', true, 'zh-CN');
    const marked = oracle.palaces.flatMap(p => [...p.majorStars, ...p.minorStars]).filter(s => s.mutagen);
    assert.deepEqual(marked.map(s => `${s.name}:${s.mutagen}`).sort(), actual.map(s => `${s.name}:${s.siHua}`).sort());
  } finally { astro.config({ mutagens: { 庚: ['太阳', '武曲', '太阴', '天同'] } }); }
  assert.deepEqual(generateLocalChart(c.birthInfo, defaults).palaces, normal.palaces);
  // Existing derived fields, if consumers supply them, must also follow configured 庚干.
  const supplied = structuredClone(normal);
  supplied.palaces[0].stem = 6; supplied.palaces[0].selfSihua = [];
  supplied.daXians[0].siHua = { stemIndex: 6, stemName: '庚', ...localSihuaByStem(6) };
  applyLocalSchoolPatches(supplied, config);
  assert.deepEqual(supplied.daXians[0].siHua, { stemIndex: 6, stemName: '庚', ...localSihuaByStem(6, config) });
  assert.deepEqual(supplied.palaces[0].selfSihua, supplied.palaces[0].stars.filter(s => (names as readonly string[]).includes(s.name)).map(s => ({ starName: s.name, siHua: ['禄', '权', '科', '忌'][names.indexOf(s.name as never)] })));
}
for (let i = 0; i < 10; i++) {
  const b = { ...base, year: 1984 + i };
  const original = generateLocalChart(b);
  for (const [setting, table] of [['table2', SCHOOL_AX.KY_ARR2], ['table3', SCHOOL_AX.KY_ARR3], ['table4', SCHOOL_AX.KY_ARR4]] as const) {
    const c = generateLocalChart(b, { ...defaults, kuiyue: setting });
    ['天魁', '天钺'].forEach((name, j) => {
      assert.equal(position(c, name), table[i + 1][j] - 1);
      assert.equal(c.palaces.flatMap(p => p.stars).filter(s => s.name === name).length, 1);
      assert.equal(c.palaces.flatMap(p => p.stars).find(s => s.name === name)?.brightnessRaw, schoolStarBrightness(name, position(c, name)!));
    });
  }
  for (const [setting, table] of [['single', SCHOOL_AX.JK_ARR1], ['zhanyan', SCHOOL_AX.JK_ARR3]] as const) {
    const c = generateLocalChart(b, { ...defaults, jiekong: setting });
    assert.equal(position(c, '截空'), table[i + 1] - 1);
    assert.equal(position(c, '副截'), undefined);
    for (const name of ['旬空', '副旬']) assert.equal(position(c, name), position(original, name));
  }
  for (const gender of ['male', 'female'] as const) {
    const plain = generateLocalChart({ ...b, gender });
    const c = generateLocalChart({ ...b, gender }, { ...defaults, tianshiTianshang: 'iztro-zhongzhou' });
    const swap = plain.lunarInfo.yearBranch % 2 !== (gender === 'male' ? 0 : 1);
    assert.equal(position(c, '天使'), position(plain, swap ? '天伤' : '天使'));
    assert.equal(position(c, '天伤'), position(plain, swap ? '天使' : '天伤'));
  }
  assert.deepEqual(generateLocalChart(b).palaces, original.palaces);
}
for (let month = 1; month <= 12; month++) {
  const c = generateLocalChart({ ...base, month }, { ...defaults, tianma: 'lunar-month' });
  const branch = (c.lunarInfo.lunarMonth + 1) % 12;
  const engine = star.getLuYangTuoMaIndex(STEMS[c.lunarInfo.yearStem] as never, BRANCHES[branch] as never);
  assert.equal(position(c, '天马'), (engine.maIndex + 2) % 12);
}
for (const leapMonth of ['split', 'next-month', 'prev-month', 'origin-month'] as const) {
  const c = generateLocalChart(leap, { ...defaults, leapMonth, tianma: 'lunar-month' });
  const branch = (c.lunarInfo.lunarMonth + 1) % 12;
  assert.equal(position(c, '天马'), (star.getLuYangTuoMaIndex('庚', BRANCHES[branch] as never).maIndex + 2) % 12);
}
const juNames = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' };
for (const ju of [2, 3, 4, 5, 6]) for (const forward of [true, false]) {
  const start = (star.getChangesheng12StartIndex(juNames[ju as keyof typeof juNames] as never) + 2) % 12;
  const positions = lifeStageBranches(ju, forward);
  assert.equal(new Set(positions).size, 12);
  positions.forEach((branch, i) => assert.equal(branch, (start + (forward ? i : -i) + 12) % 12));
  assert.deepEqual(lifeStageBranches(ju, forward, true), ju === 5 ? positions.map(b => (b + 6) % 12) : positions);
}
const life = generateLocalChart(base, { ...defaults, changsheng: 'water-earth' });
assert.deepEqual(life.palaces.map(p => p.changsheng12).sort(), [...LIFE_STAGES].sort());
assert.deepEqual(life.palaces.map(({ changsheng12, ...p }) => p), normal.palaces);
assert.deepEqual(generateChart(base), normal);
console.log('Expanded schools: 4 庚 variants vs iztro oracle; 10 stems × KY/JK; both genders; lunar-month horse/leap policy; 120 life-stage oracle positions; defaults/config/global isolation passed.');
const combined: LocalSchoolConfig = { ...defaults, brightnessSchool: 'ZZ', gengSihua: 'GYWFX', tianma: 'lunar-month', jiekong: 'zhanyan', kuiyue: 'table4', tianshiTianshang: 'iztro-zhongzhou', changsheng: 'fire-earth' };
for (const gender of ['male', 'female'] as const) {
  const b = { ...base, gender };
  const c = generateLocalChart(b, combined);
  assert.deepEqual(generateLocalChart(c.birthInfo), c, 'all settings survive chart regeneration');
  assert.deepEqual(generateLocalChart(c.birthInfo, defaults).palaces, generateLocalChart(b).palaces, 'all settings reset without residual positions/marks/stages');
  for (const p of c.palaces) for (const s of p.stars) if (['天魁', '天钺', '天马', '截空', '天使', '天伤'].includes(s.name)) assert.equal(s.brightnessRaw, schoolStarBrightness(s.name, p.branch, 'ZZ'));
}
console.log('Combined school settings: regeneration, opposite gender isolation, all reset and selected-brightness relocation passed.');
