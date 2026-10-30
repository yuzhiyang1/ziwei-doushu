import assert from 'node:assert/strict';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from '../../lib/local-chart';
import { buildPeriodAnalysis, analyzePeriodBranch, formatPeriodReport, normalizePeriodPalace } from '../../lib/local-period-analysis';
import { defaultTimeSelection, resolveTimeContext, type TimeContext, type TimeView } from '../../lib/local-time';
import { PALACE_NAMES_ORDER } from '../../lib/ziwei/constants';

const chart=generateLocalChart({year:1990,month:5,day:17,hour:3,gender:'male'});
const original=JSON.stringify(chart);
const selection={...defaultTimeSelection(chart),date:'2030-07-01',hour:6,view:'liuyue' as const};
// Artificial independent oracle: current 命宫 at 子, 财帛 at 申; stars are unique test records.
const fixture=structuredClone(chart);
fixture.palaces.forEach(p=>{p.stars=[];});
fixture.palaces.find(p=>p.branch===8)!.stars=[{name:'武曲',type:'major',siHua:'科',brightnessRaw:'庙'}];
fixture.palaces.find(p=>p.branch===2)!.stars=[{name:'紫微',type:'major'}];
const context:TimeContext={label:'流月',description:'人工独立映射',overlay:{武曲:'忌',紫微:'禄'},palaceNames:{},transitStars:{8:['流月测试曜']},mingBranch:0,effectiveDaXianIndex:-1};
PALACE_NAMES_ORDER.forEach((name,i)=>{context.palaceNames[(12-i)%12]=name;});
context.palaceNames[5]='仆役宫'; // alias at current friendship palace
const before=JSON.stringify({fixture,context});
const sections=buildPeriodAnalysis(fixture,selection,context);
const wealth=sections.find(s=>s.period?.themePalace==='财帛宫')!;
assert.equal(wealth.period!.branch,8);
assert.equal(wealth.period!.natalPalace,normalizePeriodPalace(fixture.palaces.find(p=>p.branch===8)!.name));
assert.deepEqual(wealth.period!.periodHua,[{star:'武曲',hua:'忌'}]);
assert.equal(wealth.period!.natalStars[0].siHua,'科');
assert.deepEqual(wealth.period!.transitStars,['流月测试曜']);
assert.deepEqual(wealth.period!.related.map(p=>[p.branch,p.relation]),[[0,'trine'],[4,'trine'],[2,'opposite']]);
assert.match(wealth.evidence.join('\n'),/生年化科/);assert.match(wealth.evidence.join('\n'),/流月四化：武曲化忌/);
assert.match(wealth.questions.join(''),/不据此投资/);
assert.match(sections.find(s=>s.period?.themePalace==='疾厄宫')!.questions.join(''),/不能诊断疾病/);
const empty=analyzePeriodBranch(fixture,2,{...selection,view:'liuri'},context);
assert.equal(empty.period!.borrowedMajorStars.length,0,'nonempty palace does not borrow');
const borrowing=analyzePeriodBranch(fixture,0,selection,context);
assert.deepEqual(borrowing.period!.borrowedMajorStars,[]);
assert.match(borrowing.evidence.join(''),/不等于搬入本宫/);
const borrowFixture=structuredClone(fixture);
borrowFixture.palaces.find(p=>p.branch===6)!.stars=[{name:'天机',type:'major'}];
const borrowed=analyzePeriodBranch(borrowFixture,0,selection,context);
assert.deepEqual(borrowed.period!.borrowedMajorStars,['天机']);
assert.deepEqual(borrowed.period!.natalStars,[],'borrowing reference never inserts stars into this palace');
assert.equal(JSON.stringify({fixture,context}),before,'analysis never mutates chart or context');
// Returned data are snapshots, not references into chart/context.
wealth.period!.natalStars[0].name='modified';wealth.period!.transitStars.push('modified');
assert.equal(JSON.stringify({fixture,context}),before);
assert.equal(sections[0].summary!.transformations.find(h=>h.star==='武曲')!.branches[0],8);
assert.equal(sections.find(s=>s.period?.themePalace==='交友宫')!.period!.branch,5);
const rotated={...context,palaceNames:Object.fromEntries(Object.entries(context.palaceNames).map(([b,name])=>[(Number(b)+1)%12,name])),mingBranch:1};
const rotatedWealth=buildPeriodAnalysis(fixture,selection,rotated).find(s=>s.period?.themePalace==='财帛宫')!;
assert.equal(rotatedWealth.period!.branch,9);assert.equal(rotatedWealth.id,wealth.id,'topic id remains stable when its branch changes');
assert.notDeepEqual(rotatedWealth.evidence,wealth.evidence);
assert.deepEqual(rotatedWealth.period!.periodHua,[]);assert.deepEqual(rotatedWealth.period!.transitStars,[]);
assert.throws(()=>buildPeriodAnalysis(fixture,selection,{...context,palaceNames:{}}),/不完整/);
assert.throws(()=>analyzePeriodBranch(chart,12,selection),/0–11/);

for(const date of ['2026-02-16','2026-02-17','2024-02-29','2023-03-22','2030-07-01']) {
 for(const hour of [0,6,11]) {
  for(const view of ['mingpan','daxian','liunian','liuyue','liuri','liushi'] as TimeView[]) {
   const s={...selection,date,hour,view,daXianIndex:0};const c=resolveTimeContext(chart,s);
   const result=buildPeriodAnalysis(chart,s,c);
   assert.equal(result.length,13);assert.equal(new Set(result.map(r=>r.id)).size,13);
   assert.deepEqual(result.slice(1).map(r=>r.period!.themePalace),PALACE_NAMES_ORDER);
   assert.equal(new Set(result.slice(1).map(r=>r.period!.branch)).size,12);
   for(const section of result.slice(1)) {
    const p=section.period!;assert.ok(section.evidence.length>=5);assert.ok(section.interpretation.length>100);
    if(view==='mingpan') {assert.equal(p.themePalace,p.natalPalace);assert.deepEqual(p.periodHua,[]);assert.deepEqual(p.transitStars,[]);}
    else {assert.equal(p.themePalace,normalizePeriodPalace(c.palaceNames[p.branch]));assert.deepEqual(p.transitStars,c.transitStars[p.branch]??[]);for(const h of p.periodHua)assert.equal(h.hua,c.overlay[h.star]);}
   }
   const report=formatPeriodReport(chart,s,c);assert.equal((report.match(/^## /gm)??[]).length,13);
   assert.ok(report.includes(result[4].evidence[1]));
  }
 }
}
for(let i=0;i<chart.daXians.length;i++) {
 const s={...selection,view:'daxian' as const,daXianIndex:i};const result=buildPeriodAnalysis(chart,s);
 assert.equal(result[0].summary!.mingBranch,chart.daXians[i].palaceBranch);
 assert.equal(result[0].summary!.effectiveDaXianIndex,i);
}
const yearly0=buildPeriodAnalysis(chart,{...selection,view:'liunian',hour:0});
const yearly11=buildPeriodAnalysis(chart,{...selection,view:'liunian',hour:11});
assert.deepEqual(yearly0.map(s=>s.period),yearly11.map(s=>s.period),'changing hour must not fabricate changed yearly structure');
const school=generateLocalChart(chart.birthInfo,{...LOCAL_SCHOOL_DEFAULTS,gengSihua:'GYWFX'});
const schoolResult=buildPeriodAnalysis(school,{...selection,view:'liunian'});
assert.equal(schoolResult[0].summary!.transformations.find(h=>h.star==='天府')!.hua,'科');
assert.equal(schoolResult[0].summary!.transformations.find(h=>h.star==='天相')!.hua,'忌');
const childhood=buildPeriodAnalysis(chart,{...selection,view:'liunian',date:'1990-06-01'});
assert.equal(childhood[0].summary!.effectiveDaXianIndex,-1);
assert.match(childhood[0].evidence.join(''),/不强行套用第一大限/);
const sky=generateLocalChart(chart.birthInfo,{...LOCAL_SCHOOL_DEFAULTS,tiankong:'year-hour'});
const skyAnalysis=buildPeriodAnalysis(sky,selection);
const skyBranch=sky.palaces.find(p=>p.stars.some(s=>s.name==='天空'))!.branch;
assert.ok(skyAnalysis.find(s=>s.period?.branch===skyBranch)!.period!.natalStars.some(s=>s.name==='天空'));
const unknown=structuredClone(chart);unknown.birthInfo.birthTimeUnknown=true;
assert.match(buildPeriodAnalysis(unknown,selection)[0].evidence.join(''),/时辰未知/);
assert.equal(JSON.stringify(chart),original);
console.log('PASS period analysis: independent mapping/overlay oracle, 6 layers, 13 topics, 12 branches, trines/opposite, aliases, immutable snapshots, calendar/hour boundaries, all decades, selected school, report parity and non-predictive caveats');
