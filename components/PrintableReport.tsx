import type { ZiweiChart } from '@/lib/ziwei/types';
import { buildLocalAnalysis, LOCAL_ANALYSIS_NOTICE } from '@/lib/local-analysis';
import { BRANCHES } from '@/lib/ziwei/constants';
import ChartBoard from './ChartBoard';
import type { TimeSelection } from '@/lib/local-time';
export default function PrintableReport({chart,timeContext,selection}:{chart:ZiweiChart;timeContext?:string;selection:TimeSelection}) {
 const birth=chart.birthInfo;const raw=birth.origInput;
 return <article className="printable-report"><h1>个人本地命盘 · 完整十三维研究报告</h1><p>{LOCAL_ANALYSIS_NOTICE}</p><p>{birth.name||'未命名'} · {birth.gender==='male'?'男':'女'} · {raw?`${raw.year}-${raw.month}-${raw.day} ${raw.clockHour}:${String(raw.clockMinute).padStart(2,'0')}（原始钟表）`:`${birth.year}-${birth.month}-${birth.day} ${BRANCHES[birth.hour]}时（所存排盘参数）`}</p>{birth.birthTimeUnknown&&<p>警告：时辰未知，本盘仅以子时为示例。</p>}<p>排盘日：{birth.year}-{birth.month}-{birth.day} · {BRANCHES[birth.hour]}时；流派：{JSON.stringify(birth.schoolConfig||'默认')}</p><ChartBoard chart={chart} selection={selection} hideTimeNav/><p>图盘时序：{timeContext}。下列十二宫文字为本命结构，不是时段事件预测。</p>{buildLocalAnalysis(chart,timeContext).map(section=><section className="report-section" key={section.id}><h2>{section.title}</h2><ul>{section.evidence.map((line,i)=><li key={i}>{line}</li>)}</ul><p>{section.interpretation}</p><p>思考：{section.questions.join(' ')}</p></section>)}</article>;
}
