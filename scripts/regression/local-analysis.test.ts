import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { analyzePalace, buildLocalAnalysis, compareCharts, formatLocalReport, formatPairReport } from '../../lib/local-analysis';
const a = generateChart({ year: 1990, month: 6, day: 15, hour: 4, gender: 'male' });
const b = generateChart({ year: 1994, month: 12, day: 3, hour: 8, gender: 'female' });
const sections = buildLocalAnalysis(a, '测试流年 2030');
assert.equal(sections.length, 13);
assert.equal(new Set(sections.map(s => s.id)).size, 13);
assert.ok(sections[0].evidence.join().includes('测试流年 2030'));
assert.ok(sections.slice(1).every(s => s.evidence.length >= 2 && s.interpretation.length > 50));
assert.ok(sections.find(s => s.title.startsWith('夫妻'))?.title.includes('亲密关系'));
assert.notEqual(formatLocalReport(a), formatLocalReport(b));
const empty = a.palaces.find(p => !p.stars.some(s => s.type === 'major'));
if (empty) assert.ok(analyzePalace(a, empty).evidence.join().includes('不等于搬入本宫'));
assert.equal(compareCharts(a, b).length, 12);
assert.ok(compareCharts(a, a).every(row => row.similarity === 100 || row.similarity === null));
for (const row of compareCharts(a, b)) {
 const reverse = compareCharts(b, a).find(r => r.palace === row.palace)!;
 assert.equal(row.similarity, reverse.similarity);
 assert.ok(row.similarity === null || row.similarity >= 0 && row.similarity <= 100);
}
assert.ok(formatPairReport(a, b).includes('非关系吉凶预测'));
const unknown = { ...a, birthInfo: { ...a.birthInfo, birthTimeUnknown: true } };
assert.ok(formatLocalReport(unknown).includes('时辰未知'));
assert.ok(formatPairReport(unknown, b).includes('时辰未知'));
assert.deepEqual(compareCharts(a, b), compareCharts(a, b));
console.log('Local analysis: 13 evidence-based sections, inputs, empty-palace, pair symmetry and deterministic repeat passed.');
