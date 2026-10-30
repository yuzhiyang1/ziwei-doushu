import assert from 'node:assert/strict';
import { astro } from 'iztro';
import { generateChart } from '../../lib/ziwei/algorithm';
import { defaultTimeSelection, parseTimeDate, resolveTimeContext, type TimeView } from '../../lib/local-time';
const birth={year:1990,month:5,day:17,hour:3,gender:'male' as const};
const chart=generateChart(birth);
const original=JSON.stringify(chart);
for(const date of ['2026-02-16','2026-02-17','2024-02-29','2026-10-30']) {
 for(const hour of [0,1,11]) {
  const selection={...defaultTimeSelection(chart),date,hour};
  const h=astro.bySolar('1990-5-17',3,'男',true,'zh-CN').horoscope(date,hour);
  for(const [view,key] of [['liunian','yearly'],['liuyue','monthly'],['liuri','daily'],['liushi','hourly']] as const) {
    const c=resolveTimeContext(chart,{...selection,view});
    assert.equal(c.mingBranch,(h[key].index+2)%12);
    assert.equal(Object.keys(c.palaceNames).length,12);
    assert.equal(Object.keys(c.overlay).length,4);
    assert.equal(c.palaceNames[c.mingBranch!],'命宫');
    assert.match(c.description,new RegExp(date));
  }
 }
}
for(let i=0;i<chart.daXians.length;i++) {
 const c=resolveTimeContext(chart,{...defaultTimeSelection(chart),view:'daxian',daXianIndex:i});
 assert.equal(c.mingBranch,chart.daXians[i].palaceBranch);
 assert.equal(c.palaceNames[c.mingBranch!],'命宫');
 assert.equal(c.effectiveDaXianIndex,i);
}
assert.deepEqual(resolveTimeContext(chart,defaultTimeSelection(chart)).overlay,{});
for(const date of ['2026-02-29','2024-02-30','2026-13-01','2026-00-01','2026-04-31','1899-01-01','2101-01-01','']) assert.throws(()=>parseTimeDate(date));
assert.doesNotThrow(()=>parseTimeDate('2024-02-29'));
assert.throws(()=>resolveTimeContext(chart,{...defaultTimeSelection(chart),hour:12}));
assert.throws(()=>resolveTimeContext(chart,{...defaultTimeSelection(chart),view:'daxian',daXianIndex:-1}));
assert.equal(JSON.stringify(chart),original,'switches never mutate natal chart');
for(const view of ['mingpan','liushi','daxian','liuyue','liuri','liunian','mingpan'] as TimeView[]) resolveTimeContext(chart,{...defaultTimeSelection(chart),view});
console.log('local-time: six layers, engine parity, date boundaries, hour boundaries, every decade, repeated switching, immutable natal chart passed');

// Selected school convention must reach decade and annual overlays, not natal stars only.
const schoolChart = generateChart({year:1990,month:5,day:17,hour:3,gender:'male',schoolConfig:{brightnessSchool:'default',leapMonth:'split',lateZishi:'next-day',gengSihua:'GYWFX'}});
const schoolAnnual=resolveTimeContext(schoolChart,{...defaultTimeSelection(schoolChart),view:'liunian',date:'2030-07-01'});
assert.equal(schoolAnnual.overlay['天府'],'科');assert.equal(schoolAnnual.overlay['天相'],'忌');
const gengDecade=schoolChart.daXians.findIndex(dx=>schoolChart.palaces.find(p=>p.branch===dx.palaceBranch)?.stem===6);
assert.ok(gengDecade>=0);
const schoolDecade=resolveTimeContext(schoolChart,{...defaultTimeSelection(schoolChart),view:'daxian',daXianIndex:gengDecade});
assert.equal(schoolDecade.overlay['天府'],'科');assert.equal(schoolDecade.overlay['天相'],'忌');
console.log('local-time: selected Geng four-transformations propagated to annual and decade overlays');
