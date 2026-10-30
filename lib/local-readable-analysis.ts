/** Locally authored traditional-symbol commentary: no model, network or private text corpus. */
import { buildPeriodAnalysis, type PeriodAnalysisSection, type PeriodEvidence } from './local-period-analysis';
import { resolveTimeContext, TIME_LABELS, type TimeContext, type TimeSelection } from './local-time';
import { BRANCHES } from './ziwei/constants';
import type { ZiweiChart } from './ziwei/types';
export interface ReadableAnalysisSection {
 id:string; title:string; headline:string; summary:string;
 strengths:[string,string]; watchouts:[string,string]; suggestions:[string,string];
 evidenceChips:string[]; sourceNote:string;
}
export const READABLE_SOURCE_NOTE='本地原创传统象征解读，依据当前盘面生成；不是古籍逐字引文或官网断语，不能据此断定人格、预测事件或替代医疗与投资判断。';
interface SymbolRule {focus:string;meaning:string;strength:string;tension:string;action:string;mode:'lead'|'adapt'|'steady'|'explore'}
export const READABLE_STAR_RULES:Record<string,SymbolRule>={
 紫微:{focus:'统筹与授权',meaning:'紫微的重点是把分散的人与事组织起来，先确定方向，再分配责任；不是事事亲自承担。',strength:'能用整体目标协调不同意见，为事情建立清晰秩序。',tension:'若把负责等同于控制，容易忽略他人的专业与感受。',action:'列出必须亲自决定的事项，其余明确授权并约定回报节点。',mode:'lead'},
 天机:{focus:'思考与迭代',meaning:'天机着重观察变化并调整方法，价值在于找出可行路径，而不是一直寻找绝对完美的答案。',strength:'适合拆解问题、比较路径，并随新信息修正计划。',tension:'方案不断更换时，准备可能挤占实际行动的时间。',action:'给研究设定截止时间，用一次小实验替代继续空想。',mode:'adapt'},
 太阳:{focus:'表达与承担',meaning:'太阳强调把意图讲清楚，并通过可见行动支持他人；付出能被理解，比默默承担一切更重要。',strength:'愿意分享信息、提供支持，让共同目标更容易被看见。',tension:'过度承担或期待他人自然领情，可能积累疲惫与误会。',action:'先确认对方需要什么帮助，再说明自己的可用时间和边界。',mode:'lead'},
 武曲:{focus:'执行与核算',meaning:'武曲重视可衡量的成果与资源配置，适合把模糊愿望落成步骤；效率需要与人的感受并行。',strength:'能够通过清单、预算和复盘把事情推进到完成。',tension:'只看数字或结果，可能漏掉沟通成本与长期关系。',action:'除结果指标外，增加一次对参与者感受和负担的核对。',mode:'steady'},
 天同:{focus:'协调与舒适',meaning:'天同关注体验、协作和可持续的节奏，提醒人保留生活余地；舒服不等于所有困难都应回避。',strength:'有利于营造容易交流的氛围，并照顾过程中的体验。',tension:'为维持和气而拖延决定，可能让小问题越积越多。',action:'选择一件不愿面对的小事，在温和但明确的期限内处理。',mode:'steady'},
 廉贞:{focus:'边界与原则',meaning:'廉贞把注意力放在规则、关系分寸和内在要求上，适合厘清可接受与不可接受的范围。',strength:'能发现职责或规则含混之处，推动更清楚的约定。',tension:'原则若缺少解释，可能被理解为防备或难以协商。',action:'把底线与可商量的偏好分开说，并给出具体理由。',mode:'lead'},
 天府:{focus:'积累与安排',meaning:'天府重视已有资源的维护与长期安排，强调先有稳定基础，再承接新的责任或变化。',strength:'适合整理资源、建立缓冲，并让日常运作保持稳定。',tension:'太依赖熟悉做法时，可能延后必要的更新与放手。',action:'盘点哪些安排仍有效，挑一项低风险流程进行更新。',mode:'steady'},
 太阴:{focus:'细节与内省',meaning:'太阴关注细微体验、准备工作和内在需要，适合把不易被注意的问题整理清楚再表达。',strength:'能从细节与长期感受中发现值得照顾的需要。',tension:'反复揣测而不直接询问，容易把自己的担忧当成对方想法。',action:'把一个猜测改成开放问题，向相关的人直接求证。',mode:'steady'},
 贪狼:{focus:'探索与取舍',meaning:'贪狼象征兴趣、交往与多种可能，重点不是追求越多越好，而是在探索后辨认真正值得投入的方向。',strength:'有利于接触不同经验，发现跨领域的连接与机会。',tension:'同时开启太多目标时，注意力和资源容易分散。',action:'保留一个主要目标，其余兴趣设置明确的时间与费用上限。',mode:'explore'},
 巨门:{focus:'辨析与沟通',meaning:'巨门强调提问、辨别和澄清，适合检查话语背后的条件；说得有道理也需要让对方听得进去。',strength:'能识别模糊概念，把争议拆成可以讨论的具体问题。',tension:'若讨论变成证明谁对谁错，实质问题反而难以解决。',action:'先复述对方观点并确认理解，再只讨论一个可核实的分歧。',mode:'adapt'},
 天相:{focus:'协作与平衡',meaning:'天相着重角色配合、程序与公平，适合连接不同立场；维持平衡不必意味着永远牺牲自己的需要。',strength:'有利于梳理分工，让规则与各方需要更容易兼顾。',tension:'过度等待他人认可，可能使自己的优先事项迟迟不明。',action:'在协调别人之前，先写下自己不能省略的一项需要。',mode:'steady'},
 天梁:{focus:'照顾与经验',meaning:'天梁关注经验、原则与支持，适合从较长时间尺度看问题；提供建议仍需尊重对方选择。',strength:'能够总结经验，为复杂局面提供稳定的参考与照顾。',tension:'未经邀请就指导别人，可能让关心变成压力。',action:'先问对方希望被倾听还是需要建议，再决定如何参与。',mode:'lead'},
 七杀:{focus:'决断与边界',meaning:'七杀突出在限制下作决定、建立明确边界的象征，适合处理需要果断推进的问题，同时保留复核机制。',strength:'有利于明确优先级，在复杂任务中抓住关键行动。',tension:'只顾迅速突破时，可能低估协作、缓冲与后续维护。',action:'行动前确认可撤回点、支持者与停止条件。',mode:'lead'},
 破军:{focus:'调整与重建',meaning:'破军关注旧安排的拆解与重组，适合识别不再有效的做法；改变应服务于具体需要，而不只是厌倦现状。',strength:'能重新检查既有假设，为停滞问题尝试不同结构。',tension:'先推翻后规划，可能让过渡成本和资源缺口扩大。',action:'先保留必要的基础，再用小范围试点验证新的安排。',mode:'explore'},
};
const THEMES:Record<string,{name:string;frame:string;practice:string;risk:string}>={
 命宫:{name:'行动方式',frame:'这里看的是面对选择时怎样分配注意力、表达需要与承担责任。',practice:'记录一次真实选择：当时有哪些选项、依据和后续反馈。',risk:'不要把熟悉的做法当成不能改变的性格标签。'},
 兄弟宫:{name:'同辈支持',frame:'这里讨论同辈之间的支持、竞争与互相承担，不替任何具体亲友下结论。',practice:'与同辈明确一项互助约定，包括可做到与做不到的部分。',risk:'不要用亲近关系替代对资源和责任的清楚说明。'},
 夫妻宫:{name:'亲密协商',frame:'这里把关系中的表达、承诺与相处节奏放在一起看，重点是双方如何协商。',practice:'找一个不争论的时间，分别说明期待、边界与希望获得的支持。',risk:'差异不是不合或婚变的证据，沉默也不等于同意。'},
 子女宫:{name:'照顾与培养',frame:'这里讨论照顾、指导或培养关系，既包括投入，也包括给对方成长与选择的空间。',practice:'把一项替对方作主的安排，改成先询问其实际需要与意愿。',risk:'不能把自己的投入换算成对方必须接受的结果。'},
 财帛宫:{name:'资源管理',frame:'这里关注获取、分配与使用资源的方式，更适合检查收支习惯，而非估算财运。',practice:'核对真实账目与必要支出，重大财务决定另做风险评估。',risk:'不要用星曜或四化推导收益、借贷额度或投资时点。'},
 疾厄宫:{name:'日常照顾',frame:'这里仅作为检查作息、压力与照顾资源的提醒，重点在可观察的生活安排。',practice:'记录实际睡眠与压力变化；身体不适以正规医疗咨询为准。',risk:'此处没有疾病诊断依据，不能从星名推断病名或健康结局。'},
 迁移宫:{name:'环境适应',frame:'这里关注进入新环境、对外沟通与调动外部支持时采用什么方法。',practice:'在改变环境前列出已知条件、未知信息和可求助的人。',risk:'对新环境的想象需要实际信息校验，不能把变化等同于改善。'},
 交友宫:{name:'合作网络',frame:'这里看合作时的分工、信任与交流成本，重点在约定是否能落到行动。',practice:'为一次合作写清交付、反馈时间与退出方式。',risk:'共同兴趣并不自动意味着责任感、能力和投入程度一致。'},
 官禄宫:{name:'工作路径',frame:'这里讨论工作中的推进方式、能力发挥与目标协调，不替代对岗位和行业的调查。',practice:'选择一项可展示的小成果，用真实反馈决定下一步投入。',risk:'忙碌或名义上的责任，不一定等于有效成果或适合自己的工作。'},
 田宅宫:{name:'长期安排',frame:'这里讨论居住、生活基础与长期资源的维护，重点是稳定需要如何与变化协调。',practice:'盘点日常空间与维护成本，先解决最影响使用的一项问题。',risk:'长期安排应考虑实际预算和共同生活者意愿，不据盘面交易资产。'},
 福德宫:{name:'休息与满足',frame:'这里关注什么使人恢复精力、怎样安放期待，以及忙碌之外能否保留自己的空间。',practice:'安排一段没有绩效目标的休息，观察它是否真正帮助恢复。',risk:'他人认可与持续刺激不一定带来自己需要的满足。'},
 父母宫:{name:'代际沟通',frame:'这里把代际期待、经验传递与支持边界放在一起看，避免把关心与控制混为一谈。',practice:'与家人确认一个具体需要，再协商支持方式与各自的限度。',risk:'不能凭盘面认定家人的想法，应区分事实、期待与自己的推测。'},
};
const HUA:Record<string,string>={禄:'可留意哪些资源与支持真正有用，并考虑如何持续维护',权:'可检视主导权与责任是否对等，让决策边界更清楚',科:'可把经验整理为可沟通、可核对的表达，而不只追求外部评价',忌:'可检查反复牵挂的事项，把模糊担忧拆成能核实的小问题'};
function names(p:PeriodEvidence):string[]{const own=p.natalStars.filter(s=>s.type==='major').map(s=>s.name);return own.length?own:p.borrowedMajorStars;}
function locatedStars(p:PeriodEvidence):string {return p.natalStars.some(s=>s.type==='major')?names(p).join('、'):`空宫，参考对宫${names(p).join('、')||'亦无主星'}（不作本宫星曜）`;}
function rules(p:PeriodEvidence):SymbolRule[]{return names(p).map(n=>READABLE_STAR_RULES[n]).filter(Boolean);}
function huaText(p:PeriodEvidence):string {
 const natal=p.natalStars.filter(s=>s.siHua).map(s=>({star:s.name,hua:s.siHua!}));
 const selected=p.periodHua;
 const item=selected[0]??natal[0];
 return item?`${selected.length?'本层':'生年'}${item.star}化${item.hua}，${HUA[item.hua]??'宜结合实际情境核对其含义'}。`:'本宫没有四化标记时，仍可从星群的处理方式入手，不必强求吉凶结论。';
}
function combination(p:PeriodEvidence):string {
 const rs=rules(p);if(rs.length<2)return '单一主星意象只是切入点，还需把对宫与三合关系一并参考，观察这种做法在现实中是否适用。';
 if(rs[0].mode===rs[1].mode)return '这组星曜的取向相近，容易把同一种处理方式用得很充分；需要主动补上被忽略的另一面。';
 return `两颗主星把“${rs[0].focus}”与“${rs[1].focus}”放在同一主题中，重点是协调两种需要，而不是选定一颗、否定另一颗。`;
}
function sectionText(section:PeriodAnalysisSection,selection:TimeSelection):ReadableAnalysisSection {
 const p=section.period!, ns=names(p),rs=rules(p),theme=THEMES[p.themePalace];
 const borrowed=!p.natalStars.some(s=>s.type==='major');
 const opening=borrowed?`本宫无主星，借对宫${ns.join('、')||'结构'}作为参考，不把星搬入本宫。`:`本宫${ns.join('、')}，可从“${rs.map(r=>r.focus).join('与')}”理解${theme.name}。`;
 const meaning=rs[0]?.meaning??'无主星并不表示这个领域没有内容，可先观察对宫和三合的实际资源、关系与支持，再回到自己的经历核对。';
 const second=rs[1]?rs[1].meaning:combination(p);
 const period=selection.view==='mingpan'?'':`${TIME_LABELS[selection.view]}${p.themePalace}叠本命${p.natalPalace}，可把两类议题联系观察。`;
 const summary=opening+theme.frame+meaning+second+huaText(p)+period;
 return {id:section.id,title:section.title,headline:`${theme.name}：${rs.map(r=>r.focus).join('与')||'从关联宫位寻找线索'}`,summary,
  strengths:[rs[0]?.strength??'可以同时参考对宫与三合的不同取向，不必拘泥于单一标签。',rs[1]?.strength??`把${theme.name}与${THEMES[p.natalPalace]?.name??'实际生活'}联系起来，有助于看清资源和需要如何互相配合。`],
  watchouts:[rs[0]?.tension??'参考宫位只提供观察角度，不应被当成本宫固定拥有的特征。',theme.risk],
  suggestions:[rs[0]?.action??'先写下这个领域最具体的一项需要，并寻找现实中可用的支持。',theme.practice],
  evidenceChips:[`${TIME_LABELS[selection.view]}${p.themePalace}·${BRANCHES[p.branch]}`,`叠本命${p.natalPalace}`,`${borrowed?'对宫参考':'本宫主星'}：${ns.join('、')||'无主星'}`,...p.natalStars.filter(s=>s.siHua).map(s=>`生年${s.name}化${s.siHua}`),...p.periodHua.map(h=>`${TIME_LABELS[selection.view]}${h.star}化${h.hua}`),...p.transitStars.map(s=>`本层流曜：${s}`)],sourceNote:READABLE_SOURCE_NOTE};
}
export function buildReadableAnalysis(chart:ZiweiChart,selection:TimeSelection,context:TimeContext=resolveTimeContext(chart,selection)):ReadableAnalysisSection[] {
 const sections=buildPeriodAnalysis(chart,selection,context),details=sections.slice(1).map(s=>sectionText(s,selection));
 const get=(name:string)=>sections.find(s=>s.period?.themePalace===name)!.period!;
 const ming=get('命宫'),wealth=get('财帛宫'),career=get('官禄宫'),couple=get('夫妻宫');
 const short=(name:string,p:PeriodEvidence)=>{const hua=[...p.natalStars.filter(s=>s.siHua).map(s=>`生年${s.name}化${s.siHua}`),...p.periodHua.map(h=>`本层${h.star}化${h.hua}`)];return `${name}${locatedStars(p)}，着重${rules(p).map(r=>r.focus).join('与')||'整合关联宫位'}${hua.length?`（${hua.join('、')}）`:''}。`;};
 const shen=chart.palaces.find(p=>p.branch===chart.shenGongBranch)!;
 const summary=short('命宫',ming)+short('财帛',wealth)+short('官禄',career)+short('夫妻',couple)+`合起来看，可先用行动方式确定目标，再检查资源能否支持工作安排，并为关系沟通留下空间。身宫落${shen.name}，可把${THEMES[shen.name]?.name??'这一生活主题'}作为持续实践的关注点。`+(chart.birthInfo.birthTimeUnknown?'时辰未知，当前只展示子时示例，以上主题需待输入确定后重看。':'这些方向需要用真实经历逐项核对；相互牵连的需要，应通过具体安排协调，而不是简单评为好或坏。');
 const m=rules(ming)[0],c=rules(career)[0];
 const overview:ReadableAnalysisSection={id:'overview',title:`总览 · ${TIME_LABELS[selection.view]}可读解读`,headline:`先看${m?.focus??'关联宫位'}，再协调资源、工作与关系`,summary,
  strengths:[m?.strength??'从命宫对宫与三合中比较不同路径，有助于拓展观察角度。',c?.strength??'把工作目标拆为可验证步骤，有助于看清现实支持。'],
  watchouts:[m?.tension??'空宫不是没有方向，也不宜把对宫特征全部套在自己身上。','资源、工作和关系的需要可能不同；不要让一个领域的投入自动替代另一领域的沟通。'],
  suggestions:[m?.action??'从最关心的一个领域开始，写下现状、证据与下一步。','分别记录一项预算安排、一项工作目标与一次关系协商，再检查它们是否互相挤占。'],
  evidenceChips:[`当前层：${TIME_LABELS[selection.view]}`,`身宫：${shen.name}`, ...[ming,wealth,career,couple].flatMap(p=>[`${p.themePalace}：${locatedStars(p)}`,...p.natalStars.filter(s=>s.siHua).map(s=>`生年${s.name}化${s.siHua}`),...p.periodHua.map(h=>`${TIME_LABELS[selection.view]}${h.star}化${h.hua}`)])],sourceNote:READABLE_SOURCE_NOTE};
 return [overview,...details];
}
