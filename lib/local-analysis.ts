/** Original, transparent study rules. Not the commercial service's interpretation database. */
import type { LocalSchoolConfig, Palace, ZiweiChart } from './ziwei/types';
import { BRANCHES } from './ziwei/constants';

export const LOCAL_ANALYSIS_NOTICE = '个人版原创规则摘要，不是官网专业版断语或 AI 结论。紫微斗数为传统文化研究，不能验证人格、预测事件或代替医疗、投资与关系决策。';
export interface AnalysisSection { id: string; title: string; evidence: string[]; interpretation: string; questions: string[]; sourceQuery?: string }
const THEMES: Record<string, [string, string]> = {
  '命宫': ['自我与行动方式', '哪些特征符合你的实际经历，哪些并不符合？'],
  '兄弟宫': ['同辈支持与边界', '与同辈的支持和责任是否对等？'],
  '夫妻宫': ['亲密关系中的协商', '双方是否直接谈过期待、界限与冲突处理？'],
  '子女宫': ['照顾、培养与传承', '怎样尊重被照顾者的选择，而非替其决定？'],
  '财帛宫': ['资源获取与使用', '实际收支和风险承受能力如何？请以账目而非命盘决策。'],
  '疾厄宫': ['日常照顾与作息', '作息与压力管理是否需要改善？命盘不能诊断疾病；不适请咨询专业医生。'],
  '迁移宫': ['外部环境与适应', '新环境需要补充哪些现实信息与支持？'],
  '交友宫': ['合作网络与信任', '合作的责任、退出方式与边界是否明确？'],
  '仆役宫': ['合作网络与信任', '合作的责任、退出方式与边界是否明确？'],
  '官禄宫': ['工作方式与目标', '哪些能力已有作品或反馈支持，下一步如何验证？'],
  '田宅宫': ['居住与长期安排', '居住安排是否符合现实预算和家人的共同需要？'],
  '福德宫': ['休息与主观满足', '什么活动真正帮助你恢复精力？'],
  '父母宫': ['代际沟通与支持', '能否区分自己的期待与家人的期待？'],
};
const SYMBOLS: Record<string, string> = {
  紫微: '组织与主导', 天机: '思考与调整', 太阳: '表达与承担', 武曲: '执行与资源管理',
  天同: '舒适与协调', 廉贞: '边界与规则', 天府: '积累与安排', 太阴: '细节与内省',
  贪狼: '探索与兴趣', 巨门: '辨析与沟通', 天相: '协作与平衡', 天梁: '照顾与原则',
  七杀: '决断与突破', 破军: '改变与重建',
};
export function schoolEvidence(chart: ZiweiChart): string {
  const c: LocalSchoolConfig = chart.birthInfo.schoolConfig ?? { brightnessSchool: 'default', leapMonth: 'split', lateZishi: 'next-day' };
  return `排盘口径：亮度表 ${c.brightnessSchool}；闰月 ${c.leapMonth}；晚子时 ${c.lateZishi}；庚四化 ${c.gengSihua ?? 'default'}；天马 ${c.tianma ?? 'year'}；截空 ${c.jiekong ?? 'default'}（旬空/副旬不变）；魁钺 ${c.kuiyue ?? 'default'}；天使天伤 ${c.tianshiTianshang ?? 'default'}；长生 ${c.changsheng ?? 'default（不显示）'}。天空 ${c.tiankong ?? 'year'}（year-hour为公开顺加生时独立规则，非官网算法验证）。`;
}
export function palaceEvidence(p: Palace): string {
  return `${p.name}（${BRANCHES[p.branch]}）：${p.stars.map(s => `${s.name}${s.brightnessRaw ? `〔${s.brightnessRaw}〕` : ''}${s.siHua ? `化${s.siHua}` : ''}`).join('、') || '无星曜记录'}`;
}
export function analyzePalace(chart: ZiweiChart, palace: Palace): AnalysisSection {
  const major = palace.stars.filter(s => s.type === 'major');
  const opposite = chart.palaces.find(p => p.branch === (palace.branch + 6) % 12);
  const related = chart.palaces.filter(p => [(palace.branch + 4) % 12, (palace.branch + 8) % 12, (palace.branch + 6) % 12].includes(p.branch));
  const studied = major.length ? major : opposite?.stars.filter(s => s.type === 'major') ?? [];
  const theme = THEMES[palace.name] ?? THEMES[`${palace.name}宫`] ?? ['生活主题', '请结合实际经历核验。'];
  const hua = palace.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}`);
  return {
    id: `palace-${palace.branch}`, title: `${palace.name} · ${theme[0]}`,
    evidence: [palaceEvidence(palace), ...(major.length ? [] : [`本宫无主星；参考对宫 ${opposite?.name ?? '未知'} 的 ${studied.map(s => s.name).join('、') || '无主星'}，不等于搬入本宫。`]), `三方四正会照：${related.map(palaceEvidence).join('；')}`],
    interpretation: `本工具将${studied.map(s => `${s.name}的“${SYMBOLS[s.name] ?? '传统星曜'}”意象`).join('、') || '空宫与对宫'}作为观察“${theme[0]}”的讨论线索，而非对人的事实判断。${hua.length ? `盘面记录 ${hua.join('、')}。禄、权、科、忌仅分别作为资源、主导、表达、牵挂的传统观察标签，不推导必然吉凶。` : '本宫未记录生年四化；这不代表该生活领域没有变化。'}`,
    questions: [theme[1]], sourceQuery: studied[0]?.name,
  };
}
export function buildLocalAnalysis(chart: ZiweiChart, timeContext = '本命'): AnalysisSection[] {
  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const shen = chart.palaces.find(p => p.branch === chart.shenGongBranch);
  const overview: AnalysisSection = {
    id: 'overview', title: '总览 · 命身与结构',
    evidence: [...(chart.birthInfo.birthTimeUnknown ? ['警告：出生时辰未知，本盘仅以子时为示例，不可用于精确解读或合盘。'] : []), `${chart.wuxingJuName}；命宫 ${ming?.name ?? '命宫'}在${BRANCHES[chart.mingGongBranch]}；身宫落${shen?.name ?? '未知'}。`, ming ? palaceEvidence(ming) : '命宫数据缺失', `当前查看：${timeContext}`, schoolEvidence(chart)],
    interpretation: '以下十二宫均由当前排盘结果即时生成，列出星曜、亮度、生年四化与三方四正，便于对照与学习。时间上下文只描述所选时序；十二宫文字仍是本命结构，不冒充流月、流日事件预测。',
    questions: ['先核对出生日期、时辰、性别及真太阳时口径；输入变化会改变盘面。'],
  };
  return [overview, ...chart.palaces.map(p => analyzePalace(chart, p))];
}
export function formatLocalReport(chart: ZiweiChart, timeContext?: string): string {
  return [`# 个人本地命盘研究报告`, LOCAL_ANALYSIS_NOTICE, ...buildLocalAnalysis(chart, timeContext).map(s => `\n## ${s.title}\n${s.evidence.join('\n')}\n${s.interpretation}\n思考：${s.questions.join(' ')}`)].join('\n');
}
export interface PairComparison { palace: string; a: string[]; b: string[]; shared: string[]; similarity: number | null }
export function compareCharts(a: ZiweiChart, b: ZiweiChart): PairComparison[] {
  return a.palaces.map(pa => {
    const pb = b.palaces.find(p => p.name === pa.name);
    const namesA = pa.stars.filter(s => s.type === 'major').map(s => s.name).sort();
    const namesB = pb?.stars.filter(s => s.type === 'major').map(s => s.name).sort() ?? [];
    const shared = namesA.filter(name => namesB.includes(name));
    const union = new Set([...namesA, ...namesB]);
    return { palace: pa.name, a: namesA, b: namesB, shared, similarity: union.size ? Math.round(100 * shared.length / union.size) : null };
  });
}
export function formatPairReport(a: ZiweiChart, b: ZiweiChart): string {
  return ['# 双人结构对照（非关系吉凶预测）', LOCAL_ANALYSIS_NOTICE,
    ...(a.birthInfo.birthTimeUnknown || b.birthInfo.birthTimeUnknown ? ['警告：至少一方出生时辰未知，仅为子时示例，结构对照不具精确性。'] : []),
    '算法：按同名宫比较主星集合，重合度 = 共同主星数 / 两方主星并集数。空宫双方均为空时不计分；不借对宫计分，不衡量爱情、人格或成功概率。',
    ...compareCharts(a, b).map(row => `${row.palace}：甲 ${row.a.join('、') || '空宫'}；乙 ${row.b.join('、') || '空宫'}；重合 ${row.similarity === null ? '不计分' : `${row.similarity}%`}。`),
    '\n甲方盘面', schoolEvidence(a), ...a.palaces.map(palaceEvidence), '\n乙方盘面', schoolEvidence(b), ...b.palaces.map(palaceEvidence),
    '讨论建议：夫妻宫用于讨论关系期待，官禄宫用于讨论分工，财帛宫用于讨论预算；差异不是冲突证据，相似也不是适合结婚的证据。以双方真实交流、行为和意愿为准。',
  ].join('\n');
}
