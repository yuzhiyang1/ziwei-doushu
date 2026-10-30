import assert from 'node:assert/strict';
import { generateLocalChart } from '../../lib/local-chart';
import { buildReadableAnalysis, READABLE_STAR_RULES } from '../../lib/local-readable-analysis';
import { buildPeriodAnalysis } from '../../lib/local-period-analysis';
import { defaultTimeSelection, type TimeView } from '../../lib/local-time';
const a=generateLocalChart({year:1990,month:5,day:17,hour:3,gender:'male'});
const b=generateLocalChart({year:1994,month:12,day:3,hour:8,gender:'female'});
const original=JSON.stringify(a),sel={...defaultTimeSelection(a),date:'2030-07-01',hour:6};
assert.equal(Object.keys(READABLE_STAR_RULES).length,14);
assert.equal(new Set(Object.values(READABLE_STAR_RULES).map(r=>r.meaning)).size,14);
const stripStars=(s:string)=>Object.keys(READABLE_STAR_RULES).reduce((text,name)=>text.replaceAll(name,'星'),s);
let lengths:number[]=[];
for(const view of ['mingpan','daxian','liunian','liuyue','liuri','liushi'] as TimeView[]) {
 const selection={...sel,view},period=buildPeriodAnalysis(a,selection),result=buildReadableAnalysis(a,selection);
 assert.equal(result.length,13);assert.deepEqual(result.map(s=>s.id),period.map(s=>s.id));
 for(const s of result){lengths.push(s.summary.length);assert.ok(s.summary.length>=150&&s.summary.length<=300,`${view} ${s.id}: ${s.summary.length} characters`);assert.equal(s.strengths.length,2);assert.equal(s.watchouts.length,2);assert.equal(s.suggestions.length,2);assert.ok(s.evidenceChips.length>=3);assert.ok(s.headline.length>8);assert.ok(s.summary.includes('。'));assert.ok(!s.summary.includes('免责声明'));}
 assert.ok(result[0].summary.includes('命宫'));assert.ok(result[0].summary.includes('财帛'));assert.ok(result[0].summary.includes('官禄'));assert.ok(result[0].summary.includes('夫妻'));assert.ok(result[0].summary.includes('身宫'));
 assert.match(result.find(s=>s.id==='period-疾厄宫')!.watchouts.join(''),/不能|没有疾病诊断/);
 assert.match(result.find(s=>s.id==='period-财帛宫')!.watchouts.join(''),/不要.*收益/);
 const other=buildReadableAnalysis(b,selection);
 const changed=result.filter((s,i)=>stripStars(s.summary)!==stripStars(other[i].summary));
 assert.ok(changed.length>=7,`${view}: ${changed.length} meaningful differences after removing star names`);
}
const emptyChart=structuredClone(a);
emptyChart.palaces[0].stars=emptyChart.palaces[0].stars.filter(s=>s.type!=='major');
const empty=emptyChart.palaces[0];
const natal=buildReadableAnalysis(emptyChart,{...sel,view:'mingpan'});
const emptySection=natal.find(s=>s.id===`period-${empty.name}`)!;
assert.match(emptySection.summary,/本宫无主星，借对宫/);assert.ok(emptySection.summary.length>=150);
assert.ok(emptySection.strengths.some(s=>!s.includes('无主星')));
// Overview must never present borrowed opposite stars as the empty palace's own stars.
const emptyMing=structuredClone(a);
const mingPalace=emptyMing.palaces.find(p=>p.branch===emptyMing.mingGongBranch)!;
mingPalace.stars=mingPalace.stars.filter(s=>s.type!=='major');
const opposite=emptyMing.palaces.find(p=>p.branch===(emptyMing.mingGongBranch+6)%12)!;
opposite.stars=[{name:'紫微',type:'major'}];
const emptyOverview=buildReadableAnalysis(emptyMing,{...sel,view:'mingpan'})[0];
assert.match(emptyOverview.summary,/命宫空宫，参考对宫紫微（不作本宫星曜）/);
assert.ok(emptyOverview.evidenceChips.includes('命宫：空宫，参考对宫紫微（不作本宫星曜）'));
assert.ok(!emptyOverview.summary.includes('命宫紫微'));
const unknown=structuredClone(a);unknown.birthInfo.birthTimeUnknown=true;
assert.match(buildReadableAnalysis(unknown,sel)[0].summary,/时辰未知/);
assert.equal(JSON.stringify(a),original);
assert.deepEqual(buildReadableAnalysis(a,sel),buildReadableAnalysis(a,sel));
console.log(`PASS readable analysis: 14 distinct symbol rules, meaningful 13-topic summaries (${Math.min(...lengths)}–${Math.max(...lengths)} chars), six layers, cross-chart semantic differences, empty palace, unknown time, IDs and immutable deterministic output`);
