/** Original, deterministic period structure commentary. Not commercial predictions. */
import { LOCAL_ANALYSIS_NOTICE, schoolEvidence, type AnalysisSection } from './local-analysis';
import { resolveTimeContext, TIME_LABELS, type TimeContext, type TimeSelection, type TimeView } from './local-time';
import { BRANCHES, PALACE_NAMES_ORDER } from './ziwei/constants';
import type { Star, ZiweiChart } from './ziwei/types';

export interface PeriodHua { star: string; hua: string }
export interface PeriodLocation {
  branch: number; periodPalace: string; natalPalace: string;
  natalStars: Star[]; transitStars: string[]; periodHua: PeriodHua[];
}
export interface PeriodEvidence extends PeriodLocation {
  view: TimeView; themePalace: string;
  related: (PeriodLocation & { relation: 'opposite' | 'trine' })[];
  borrowedMajorStars: string[];
}
export interface PeriodSummary {
  view: TimeView; mingBranch: number; effectiveDaXianIndex: number;
  mappings: {branch:number;periodPalace:string;natalPalace:string}[];
  transformations: (PeriodHua & { branches:number[] })[];
  transitStars: {branch:number;stars:string[]}[];
}
export interface PeriodAnalysisSection extends AnalysisSection { period?: PeriodEvidence; summary?: PeriodSummary }
export const PERIOD_ANALYSIS_NOTICE = '当前单选时序的结构化研究解读：宫位映射、星曜与四化为排盘计算记录；主题联想为本工具原创传统意象，不是事件预测，也不是多层四化综合断语。';
const THEMES: Record<string, [string,string]> = {
  命宫:['自我与行动','请用实际行为和反馈检验当前行动重点，不从命盘断定人格。'],
  兄弟宫:['同辈支持','同辈之间有哪些可明确协商的责任和边界？'],
  夫妻宫:['关系协商','双方实际表达过哪些期待、边界和冲突处理方式？不以盘面判断婚变。'],
  子女宫:['照顾与培养','照顾与培养安排怎样尊重对方意愿和实际需要？'],
  财帛宫:['资源安排','请核对实际收支、预算和风险承受能力；不据此投资、借贷或预测财富。'],
  疾厄宫:['作息与照顾','请根据真实身体感受安排作息；命盘不能诊断疾病或预测健康，不适请咨询医生。'],
  迁移宫:['环境适应','外部环境有哪些已核实的信息、现实约束和可用支持？'],
  交友宫:['合作网络','合作分工、责任、退出机制是否有现实依据和共同约定？'],
  官禄宫:['工作目标','哪些工作目标有实际资源和反馈支持，下一步怎样验证？'],
  田宅宫:['居住安排','居住与长期安排是否符合实际预算和共同需要？'],
  福德宫:['休息与满足','哪些具体活动帮助恢复精力，而不是只迎合他人期待？'],
  父母宫:['代际支持','怎样区分双方期待，并明确支持的方式与限度？'],
};
const SYMBOLS:Record<string,string>={紫微:'组织',天机:'调整',太阳:'表达',武曲:'执行',天同:'协调',廉贞:'边界',天府:'安排',太阴:'内省',贪狼:'探索',巨门:'辨析',天相:'协作',天梁:'照顾',七杀:'决断',破军:'重建'};
export function normalizePeriodPalace(name:string):string {
  const full=name.endsWith('宫')?name:`${name}宫`;
  return ({仆役宫:'交友宫',奴仆宫:'交友宫',事业宫:'官禄宫'} as Record<string,string>)[full]??full;
}
function mapping(chart:ZiweiChart,selection:TimeSelection,context:TimeContext):Record<number,string> {
  const result:Record<number,string>={};
  for(let branch=0;branch<12;branch++) {
    const natal=chart.palaces.find(p=>p.branch===branch);
    if(!natal)throw new Error(`缺少${BRANCHES[branch]}宫本命数据`);
    const name=selection.view==='mingpan'?natal.name:context.palaceNames[branch];
    if(!name)throw new Error('当前时序宫名映射不完整');
    result[branch]=normalizePeriodPalace(name);
  }
  if(new Set(Object.values(result)).size!==12 || PALACE_NAMES_ORDER.some(name=>!Object.values(result).includes(name)))throw new Error('当前时序十二宫映射无效');
  return result;
}
function location(chart:ZiweiChart,branch:number,selection:TimeSelection,context:TimeContext,names:Record<number,string>):PeriodLocation {
  const natal=chart.palaces.find(p=>p.branch===branch)!;
  return {branch,periodPalace:names[branch],natalPalace:normalizePeriodPalace(natal.name),
    natalStars:natal.stars.map(star=>({...star})),
    transitStars:selection.view==='mingpan'?[]:[...(context.transitStars[branch]??[])],
    periodHua:selection.view==='mingpan'?[]:natal.stars.filter(star=>context.overlay[star.name]).map(star=>({star:star.name,hua:context.overlay[star.name]})),
  };
}
function describe(loc:PeriodLocation,label:string):string {
  const stars=loc.natalStars.map(s=>`${s.name}${s.brightnessRaw?`〔${s.brightnessRaw}〕`:''}${s.siHua?`（生年化${s.siHua}）`:''}`).join('、')||'无星曜记录';
  return `${label}${loc.periodPalace}在${BRANCHES[loc.branch]}，叠本命${loc.natalPalace}；本命星曜：${stars}；${label}四化：${loc.periodHua.map(h=>`${h.star}化${h.hua}`).join('、')||'本宫无本层四化标记'}；本层流曜：${loc.transitStars.join('、')||'未提供额外流曜'}。`;
}
export function analyzePeriodBranch(chart:ZiweiChart,branch:number,selection:TimeSelection,context:TimeContext=resolveTimeContext(chart,selection)):PeriodAnalysisSection {
  if(!Number.isInteger(branch)||branch<0||branch>11)throw new Error('宫位地支应为0–11');
  const names=mapping(chart,selection,context),loc=location(chart,branch,selection,context,names);
  const related=([4,8,6] as const).map(offset=>({...location(chart,(branch+offset)%12,selection,context,names),relation:offset===6?'opposite' as const:'trine' as const}));
  const major=loc.natalStars.filter(s=>s.type==='major');
  const borrowed=major.length?[]:related.find(p=>p.relation==='opposite')!.natalStars.filter(s=>s.type==='major').map(s=>s.name);
  const studied=major.length?major.map(s=>s.name):borrowed;
  const theme=THEMES[loc.periodPalace], natalTheme=THEMES[loc.natalPalace];
  const label=TIME_LABELS[selection.view];
  const hua=loc.periodHua.map(h=>`${h.star}化${h.hua}`).join('、');
  return {id:`period-${loc.periodPalace}`,title:`${loc.periodPalace} · ${theme[0]}`,
    period:{...loc,view:selection.view,themePalace:loc.periodPalace,related,borrowedMajorStars:borrowed},
    evidence:[`计算口径：${context.description}`,describe(loc,label),
      ...(!major.length?[`本宫无主星；仅参考对宫${related.find(p=>p.relation==='opposite')!.periodPalace}的${borrowed.join('、')||'无主星'}，不等于搬入本宫。`]:[]),
      ...related.map(p=>`${p.relation==='opposite'?'对宫':'三合会照'}：${describe(p,label)}`)],
    interpretation:`【传统意象讨论，非预测】在${label}这一观察层，以“${theme[0]}”为主题，叠本命${loc.natalPalace}的“${natalTheme[0]}”，可讨论两类现实议题的联系，不据此认定将发生事件。${studied.length?`可参考${studied.map(name=>`${name}的“${SYMBOLS[name]??'星曜'}”意象`).join('、')}，但不是个人事实。`:'本宫及对宫均无主星时，不补造星性。'}${hua?`本层记录${hua}，与生年四化分别列出；禄、权、科、忌仅用作资源、主导、表达、牵挂的传统标签。`:'本宫没有本层四化标记，不代表这一生活领域不会变化。'}${loc.transitStars.length?`本层实际流曜为${loc.transitStars.join('、')}；只记录其叠入，不将名称转换为灾祸或收益预测。`:'本层没有额外流曜数据，不借用其他时序的流曜。'}`,
    questions:[theme[1],`怎样用现实记录检验“${theme[0]}”与“${natalTheme[0]}”的联系，而不是事后套用？`],sourceQuery:studied[0],
  };
}
export function buildPeriodAnalysis(chart:ZiweiChart,selection:TimeSelection,context:TimeContext=resolveTimeContext(chart,selection)):PeriodAnalysisSection[] {
  const names=mapping(chart,selection,context),label=TIME_LABELS[selection.view];
  const mingBranch=Number(Object.keys(names).find(key=>names[Number(key)]==='命宫'));
  const transformations=selection.view==='mingpan'?[]:Object.entries(context.overlay).map(([star,hua])=>({star,hua,branches:chart.palaces.filter(p=>p.stars.some(s=>s.name===star)).map(p=>p.branch)}));
  const transitStars=selection.view==='mingpan'?[]:Object.entries(context.transitStars).filter(([,stars])=>stars.length).map(([branch,stars])=>({branch:Number(branch),stars:[...stars]}));
  const summary:PeriodSummary={view:selection.view,mingBranch,effectiveDaXianIndex:context.effectiveDaXianIndex,
    mappings:chart.palaces.map(p=>({branch:p.branch,periodPalace:names[p.branch],natalPalace:normalizePeriodPalace(p.name)})),transformations,transitStars};
  const dx=chart.daXians[context.effectiveDaXianIndex];
  const overview:PeriodAnalysisSection={id:'overview',title:`总览 · ${label}结构`,summary,
    evidence:[...(chart.birthInfo.birthTimeUnknown?['警告：时辰未知，本命及所有运限仅为子时示例，不可作确定解读。']:[]),context.description,
      `${label}命宫在${BRANCHES[mingBranch]}；本命命宫在${BRANCHES[chart.mingGongBranch]}，本命身宫在${BRANCHES[chart.shenGongBranch]}；${chart.wuxingJuName}。`,
      selection.view==='mingpan'?'本命层不添加运限四化与流曜。':dx?`有效大限：${dx.startAge}–${dx.endAge}虚岁，${BRANCHES[dx.palaceBranch]}宫。此处仅列大限背景，不合并其四化。`:'所选时点未匹配到已排大限，不强行套用第一大限。',
      `十二宫叠宫：${summary.mappings.map(m=>`${label}${m.periodPalace}在${BRANCHES[m.branch]}→本命${m.natalPalace}`).join('；')}。`,
      `本层四化分布：${transformations.map(h=>`${h.star}化${h.hua}→${h.branches.map(b=>`${BRANCHES[b]}（${names[b]}）`).join('、')||'盘中未定位'}`).join('；')||'本命层无额外运限四化'}。`,
      `本层流曜分布：${transitStars.map(p=>`${BRANCHES[p.branch]}（${names[p.branch]}）：${p.stars.join('、')}`).join('；')||'当前层未提供额外流曜'}。`,schoolEvidence(chart)],
    interpretation:PERIOD_ANALYSIS_NOTICE+'以下十二宫按当前层主题定位至实际地支，再列本命叠宫、星曜、本层四化及三方四正；不改变本命星曜，不把生年四化和运限四化混为一层。',
    questions:['先核对出生输入、当前日期/时辰、选中层与流派；输出为传统结构讨论，现实决策仍需事实依据。']};
  return [overview,...PALACE_NAMES_ORDER.map(name=>analyzePeriodBranch(chart,Number(Object.keys(names).find(key=>names[Number(key)]===name)),selection,context))];
}
export function formatPeriodReport(chart:ZiweiChart,selection:TimeSelection,context:TimeContext=resolveTimeContext(chart,selection)):string {
  return ['# 个人本地命盘 · 时序十三维结构报告',LOCAL_ANALYSIS_NOTICE,PERIOD_ANALYSIS_NOTICE,...buildPeriodAnalysis(chart,selection,context).map(section=>`\n## ${section.title}\n${section.evidence.join('\n')}\n${section.interpretation}\n思考：${section.questions.join(' ')}`)].join('\n');
}
