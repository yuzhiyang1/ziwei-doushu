import assert from 'node:assert/strict';
import { buildPairAnalysis, formatEnhancedPairReport, PAIR_ANALYSIS_NOTICE } from '../../lib/local-pair-analysis';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from '../../lib/local-chart';
import { getChapter } from '../../lib/classics';
import type { ZiweiChart } from '../../lib/ziwei/types';
const birthA = { year: 1990, month: 6, day: 15, hour: 4, gender: 'male' as const };
const birthB = { year: 1988, month: 10, day: 3, hour: 9, gender: 'female' as const };
const a = generateLocalChart(birthA), b = generateLocalChart(birthB);
const snapshotA = structuredClone(a), snapshotB = structuredClone(b);
const forward = buildPairAnalysis(a, b), reverse = buildPairAnalysis(b, a);
assert.equal(forward.length, 12);
assert.equal(new Set(forward.map(section => section.palace)).size, 12);
for (let i = 0; i < forward.length; i++) {
  const section = forward[i], flipped = reverse[i];
  assert.equal(section.palace, flipped.palace);
  assert.deepEqual(section.a, flipped.b); assert.deepEqual(section.b, flipped.a);
  assert.deepEqual(section.shared, flipped.shared); assert.deepEqual(section.union, flipped.union);
  assert.deepEqual(section.onlyA, flipped.onlyB); assert.deepEqual(section.onlyB, flipped.onlyA);
  assert.equal(section.score, flipped.score, 'Jaccard is symmetric');
  assert.equal(section.a.network.length, 4); assert.equal(section.b.network.length, 4);
  for (const [chart, side] of [[a, section.a], [b, section.b]] as const) {
    assert.equal(new Set(side.network.map(p => p.branch)).size, 4);
    for (const related of side.network) {
      const source = chart.palaces.find(p => p.branch === related.branch)!;
      assert.equal(related.palace, source.name);
      assert.deepEqual(related.major, source.stars.filter(s => s.type === 'major').map(s => s.name).sort());
      assert.deepEqual(related.hua, source.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}`).sort());
    }
    assert.equal(side.network.find(p => p.relation === '对宫')!.branch, (side.branch! + 6) % 12);
  }
  assert(section.questions.length >= 3); assert.match(section.themeBasis, /现代/);
  assert.match(section.arithmetic.join('\n'), /共同主星|不计分/);
  for (const source of section.sources) {
    const index = Number(source.href.split('/').at(-1));
    assert(getChapter('quanshu', index), 'source must link to an existing local chapter');
  }
}
assert.deepEqual(a, snapshotA); assert.deepEqual(b, snapshotB);
assert.notDeepEqual(buildPairAnalysis(a, generateLocalChart({ ...birthB, hour: 1 })), forward, 'changing a chart changes evidence');
const identical = buildPairAnalysis(a, a);
assert(identical.every(s => s.score === 100 || (s.score === null && s.union.length === 0)));
// Empty palaces do not silently borrow opposite stars into the similarity score.
const emptyA = structuredClone(a), emptyB = structuredClone(b);
const name = emptyA.palaces[0].name;
for (const chart of [emptyA, emptyB]) {
  const palace = chart.palaces.find(p => p.name === name)!;
  palace.stars = palace.stars.filter(s => s.type !== 'major');
}
const empty = buildPairAnalysis(emptyA, emptyB).find(s => s.palace === name)!;
assert.equal(empty.score, null); assert.deepEqual(empty.shared, []); assert.deepEqual(empty.union, []);
assert.equal(empty.warnings.filter(w => w.includes('不把对宫星曜搬入')).length, 2);
const missing = structuredClone(b); missing.palaces = missing.palaces.filter(p => p.name !== name);
const missingSection = buildPairAnalysis(a, missing).find(s => s.palace === name)!;
assert.equal(missingSection.score, null); assert.match(missingSection.warnings.join('\n'), /缺少此宫/);
const unknown = { ...b, birthInfo: { ...b.birthInfo, birthTimeUnknown: true } };
assert(buildPairAnalysis(a, unknown).every(s => s.warnings.some(w => w.includes('时辰未知'))));
const schoolB = generateLocalChart(birthB, { ...LOCAL_SCHOOL_DEFAULTS, brightnessSchool: 'ZZ', tiankong: 'year-hour' });
assert(buildPairAnalysis(a, schoolB).every(s => s.warnings.some(w => w.includes('口径不同'))));
assert.notEqual(formatEnhancedPairReport(a, schoolB), formatEnhancedPairReport(a, b));
assert.deepEqual(generateLocalChart(birthB), b, 'pair analysis and alternate settings do not mutate default engine');
// Keep actual 四化 evidence and per-side school identity; never turn it into a relationship verdict.
const report = formatEnhancedPairReport(a, b);
assert(report.startsWith('# 双人十二宫结构研究报告'));
assert(report.includes(PAIR_ANALYSIS_NOTICE));
assert.match(report, /盘面事实/); assert.match(report, /集合算术/); assert.match(report, /主题参照/);
assert.match(report, /甲方三方四正/); assert.match(report, /乙方三方四正/);
assert.match(report, /不跨人飞化/);
assert.doesNotMatch(report, /必定|注定|一定会|婚姻成功率[:：]|你患有|适合结婚[:：]/);
console.log('PASS 12-section pair analysis: symmetric arithmetic, chart-sensitive evidence, per-chart network/四化, empty/missing palaces, unknown time, school isolation, source links, non-predictive report');
