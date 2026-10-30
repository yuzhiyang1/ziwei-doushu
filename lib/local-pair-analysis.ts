/** Independent transparent pair-study rules; no commercial prompts or compatibility predictions. */
import type { Palace, ZiweiChart } from './ziwei/types';
import { BRANCHES, PALACE_NAMES_ORDER } from './ziwei/constants';
import { palaceEvidence, schoolEvidence } from './local-analysis';

export const PAIR_ANALYSIS_NOTICE = '本报告为个人版自研双盘结构研究，不是商业版合盘算法。盘面事实、集合算术与传统主题参照分别列示；不从相似或差异推断适婚、财富、疾病、人格或事件。';
export interface PairSource { title: string; href: string; scope: string }
export interface PairNetworkPalace { relation: string; palace: string; branch: number; major: string[]; hua: string[] }
export interface PairSideEvidence { palace: string; branch: number | null; major: string[]; detail: string; hua: string[]; network: PairNetworkPalace[] }
export interface PairAnalysisSection {
  id: string; palace: string; title: string; a: PairSideEvidence; b: PairSideEvidence;
  shared: string[]; onlyA: string[]; onlyB: string[]; union: string[]; score: number | null;
  arithmetic: string[]; theme: string; themeBasis: string; questions: string[]; warnings: string[]; sources: PairSource[];
}
const THEMES: Record<string, { topic: string; question: string; chapter?: number }> = {
  命宫: { topic: '自我表达与行动偏好', question: '各自怎样说明自己的需求？有哪些实际例子与这种主题分类不一致？', chapter: 0 },
  兄弟宫: { topic: '同辈支持与边界', question: '双方对同辈支援的时间、金钱和责任边界如何协商？' },
  夫妻宫: { topic: '关系期待与协商', question: '双方是否明确谈过亲密、独立空间、承诺和分歧处理，而非替对方猜想？', chapter: 3 },
  子女宫: { topic: '照顾、培养与自主', question: '是否讨论过照顾责任、是否育儿及尊重被照顾者自主选择？' },
  财帛宫: { topic: '资源与日常预算', question: '实际收入、支出和共同预算如何核对？哪些财务信息仍需透明沟通？不得据此投资。', chapter: 1 },
  疾厄宫: { topic: '作息与照顾需求', question: '双方希望获得怎样的日常照顾？健康问题以医学评估为准，命盘不能诊断疾病。' },
  迁移宫: { topic: '环境变化与适应', question: '面对迁居、出行或新环境，双方需要哪些现实信息和支持？' },
  交友宫: { topic: '合作网络与信任', question: '怎样明确合作分工、信息共享、退出机制和彼此社交边界？' },
  官禄宫: { topic: '工作与长期目标', question: '双方对工作投入、生活安排和下一阶段目标有哪些可验证的共识？', chapter: 2 },
  田宅宫: { topic: '居住与共同安排', question: '居住空间、家庭劳动和长期安排能否按实际需要与预算讨论？' },
  福德宫: { topic: '休息与主观满足', question: '各自真正恢复精力的方法是什么？怎样给彼此留出休息和兴趣空间？' },
  父母宫: { topic: '代际沟通与支持', question: '双方怎样区分自己与长辈的期待，并共同设定代际支持边界？' },
};
function canonical(name: string): string { const normalized = name.endsWith('宫') ? name : `${name}宫`; return normalized === '仆役宫' ? '交友宫' : normalized; }
function majors(palace?: Palace): string[] { return [...new Set(palace?.stars.filter(s => s.type === 'major').map(s => s.name) ?? [])].sort(); }
function hua(palace?: Palace): string[] { return palace?.stars.filter(s => s.siHua).map(s => `${s.name}化${s.siHua}`).sort() ?? []; }
function side(chart: ZiweiChart, name: string): PairSideEvidence {
  const palace = chart.palaces.find(p => canonical(p.name) === name);
  if (!palace) return { palace: name, branch: null, major: [], detail: `${name}缺失，不能将缺失数据当作空宫。`, hua: [], network: [] };
  const network = [{ offset: 0, relation: '本宫' }, { offset: 4, relation: '三合宫一' }, { offset: 8, relation: '三合宫二' }, { offset: 6, relation: '对宫' }].flatMap(({ offset, relation }) => {
    const related = chart.palaces.find(p => p.branch === (palace.branch + offset) % 12);
    return related ? [{ relation, palace: related.name, branch: related.branch, major: majors(related), hua: hua(related) }] : [];
  });
  return { palace: palace.name, branch: palace.branch, major: majors(palace), detail: palaceEvidence(palace), hua: hua(palace), network };
}
export function buildPairAnalysis(a: ZiweiChart, b: ZiweiChart): PairAnalysisSection[] {
  return PALACE_NAMES_ORDER.map((name, index) => {
    const left = side(a, name), right = side(b, name);
    const shared = left.major.filter(star => right.major.includes(star));
    const union = [...new Set([...left.major, ...right.major])].sort();
    const onlyA = left.major.filter(star => !right.major.includes(star)), onlyB = right.major.filter(star => !left.major.includes(star));
    const missing = left.branch === null || right.branch === null;
    const score = !missing && union.length ? Math.round(shared.length / union.length * 10000) / 100 : null;
    const theme = THEMES[name];
    const sources: PairSource[] = [{ title: '本仓库《紫微斗数全书》精选·命宫', href: '/library/quanshu/0', scope: '仅参照主星、四化与三方四正的传统观察框架；本仓库文本为现代整理，未经原本校勘。集合比较和提问均为本工具原创。' }];
    if (theme.chapter !== undefined && theme.chapter !== 0) sources.push({ title: `本仓库《紫微斗数全书》精选·${name}`, href: `/library/quanshu/${theme.chapter}`, scope: '仅作宫位主题参照，不采纳其中的吉凶或人物断语，不为双方关系作预测。' });
    const warnings = [
      ...(a.birthInfo.birthTimeUnknown || b.birthInfo.birthTimeUnknown ? ['至少一方时辰未知；仅为子时假设盘，以下差异不能当作精确双盘结论。'] : []),
      ...(missing ? ['至少一方缺少此宫数据，本节不计相似度。'] : []),
      ...(!left.major.length && left.branch !== null ? ['甲方本宫无主星；对宫另列参照，不把对宫星曜搬入本宫或计入相似度。'] : []),
      ...(!right.major.length && right.branch !== null ? ['乙方本宫无主星；对宫另列参照，不把对宫星曜搬入本宫或计入相似度。'] : []),
      ...(schoolEvidence(a) !== schoolEvidence(b) ? ['双方排盘口径不同；差异可能来自口径而非出生条件，须先核对设置。'] : []),
    ];
    return {
      id: `pair-${index}`, palace: name, title: `${name} · ${theme.topic}`, a: left, b: right, shared, onlyA, onlyB, union, score,
      arithmetic: [
        `共同主星：${shared.join('、') || '无'}；甲方独有：${onlyA.join('、') || '无'}；乙方独有：${onlyB.join('、') || '无'}。`,
        score === null ? '结构重合度不计分：双方均无主星，或至少一方数据缺失。' : `结构重合度 ${score}% = ${shared.length} 个共同主星 ÷ ${union.length} 个并集主星 × 100；只按星名比较，不给亮度或四化额外加分。`,
        `甲方本宫四化：${left.hua.join('、') || '无记录'}；乙方本宫四化：${right.hua.join('、') || '无记录'}。无记录不等于该领域没有现实变化。`,
      ],
      theme: theme.topic,
      themeBasis: theme.chapter !== undefined ? '传统主题参照：以所列本仓库公开精选的宫位主题为入口；下面的问题是现代自主协商提示，不是古籍原话或对人的判断。' : '现代讨论分类：本节生活主题与问题由本工具自拟；所列来源只支持观察框架，不声称有逐句古籍依据。',
      questions: [theme.question, shared.length ? `共同主星 ${shared.join('、')} 只是盘面重合；双方真实经历有哪些相同和不同，能否各举一例？` : '本宫主星没有重合，不等于现实中没有共同点；双方能否各举一个合作顺畅与需要调整的实际例子？', '若改变出生时辰或排盘口径，本节哪些证据会改变？先核对输入，再讨论现实情况。'],
      warnings, sources,
    };
  });
}
function networkText(side: PairSideEvidence): string { return side.network.map(p => `${p.relation} ${p.palace}（${BRANCHES[p.branch]}）：${p.major.join('、') || '无主星'}；四化 ${p.hua.join('、') || '无记录'}`).join('；'); }
export function formatEnhancedPairReport(a: ZiweiChart, b: ZiweiChart): string {
  return ['# 双人十二宫结构研究报告', PAIR_ANALYSIS_NOTICE, `甲方 ${schoolEvidence(a)}`, `乙方 ${schoolEvidence(b)}`,
    '三方四正仅在各自命盘内按本宫、顺行四宫、顺行八宫及对宫分别列出，不跨人飞化、不推导婚配结论。星曜亮度、四化保留在原始证据，不暗中并入相似度。',
    ...buildPairAnalysis(a, b).flatMap(section => [`\n## ${section.title}`, ...section.warnings.map(s => `注意：${s}`), '### 盘面事实', `甲方：${section.a.detail}`, `乙方：${section.b.detail}`, `甲方三方四正：${networkText(section.a)}`, `乙方三方四正：${networkText(section.b)}`, '### 集合算术（非适配评分）', ...section.arithmetic, '### 主题参照与研究问题', section.themeBasis, ...section.questions.map(q => `- ${q}`), ...section.sources.map(s => `参照：${s.title} ${s.href}；${s.scope}`)]),
  ].join('\n');
}
