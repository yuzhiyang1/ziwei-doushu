'use client';
import { useState } from 'react';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import LocalArchives from '@/components/LocalArchives';
import ChatPanel from '@/components/ChatPanel';
import { chartId } from '@/lib/local-store';
import { generateLocalChart as generateChart } from '@/lib/local-chart';
import LocalSchoolSettings from '@/components/LocalSchoolSettings';
import { LOCAL_ANALYSIS_NOTICE } from '@/lib/local-analysis';
import { buildPairAnalysis, formatEnhancedPairReport, PAIR_ANALYSIS_NOTICE } from '@/lib/local-pair-analysis';
import { BRANCHES } from '@/lib/ziwei/constants';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';

export default function HemingPage() {
  const [charts, setCharts] = useState<[ZiweiChart | null, ZiweiChart | null]>([null, null]);
  const [forms, setForms] = useState<[BirthFormState | undefined, BirthFormState | undefined]>([undefined, undefined]);
  const [savedForms, setSavedForms] = useState<[BirthFormState | undefined, BirthFormState | undefined]>([undefined, undefined]);
  const [editing, setEditing] = useState<[boolean, boolean]>([true, true]);
  const [error, setError] = useState('');
  const [showBoards, setShowBoards] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const submit = (index: 0 | 1, info: BirthInfo) => {
    try {
      const chart = generateChart({ ...info, schoolConfig: charts[index]?.birthInfo.schoolConfig });
      setCharts(prev => index === 0 ? [chart, prev[1]] : [prev[0], chart]);
      setEditing(prev => index === 0 ? [false, prev[1]] : [prev[0], false]);
      setSavedForms(prev => index === 0 ? [forms[0], prev[1]] : [prev[0], forms[1]]);
      setConfirmed(false); setShowAI(false); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败，请核对输入'); }
  };
  const a = charts[0], b = charts[1];
  const ready = !!a && !!b && !editing.some(Boolean);
  const sections = ready ? buildPairAnalysis(a!, b!) : [];
  const report = ready ? formatEnhancedPairReport(a!, b!) : '';
  const download = () => {
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '双人命盘结构对照.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
    <nav><a href="/chart" className="underline">← 个人命盘</a></nav>
    <h1 className="text-2xl font-semibold">本地双人合盘</h1>
    <p className="text-sm leading-relaxed">{LOCAL_ANALYSIS_NOTICE} 以下结构对照完全在浏览器计算，无需账号、付费或服务器。请先取得对方同意，不要擅自输入他人生辰。</p>
    <div className="grid md:grid-cols-2 gap-6">{([0, 1] as const).map(i => <section key={i} className="card-glass rounded-xl p-4 space-y-3">
      <h2 className="text-lg">{i === 0 ? '甲方' : '乙方'}</h2>
      {editing[i] ? <>
        <BirthForm initialData={forms[i]} onFormSave={data => setForms(prev => i === 0 ? [data, prev[1]] : [prev[0], data])} onSubmit={info => submit(i, info)} />
        {charts[i] && <button type="button" className="border rounded px-3 py-2" onClick={() => { setForms(prev => i === 0 ? [savedForms[0], prev[1]] : [prev[0], savedForms[1]]); setEditing(prev => i === 0 ? [false, prev[1]] : [prev[0], false]); }}>取消编辑，保留原盘</button>}
      </> : <>
        <p>{charts[i]?.birthInfo.name || '未命名'} · {charts[i]?.birthInfo.year}-{charts[i]?.birthInfo.month}-{charts[i]?.birthInfo.day} · {charts[i]?.wuxingJuName}</p>
        <button type="button" className="border rounded px-3 py-2" onClick={() => { setEditing(prev => i === 0 ? [true, prev[1]] : [prev[0], true]); setShowAI(false); }}>编辑并重新排盘</button>
      </>}
      {charts[i] && !editing[i] && <LocalSchoolSettings birth={charts[i]!.birthInfo} onChange={chart => { setCharts(prev => i === 0 ? [chart, prev[1]] : [prev[0], chart]); setConfirmed(false); setShowAI(false); }} />}
      <LocalArchives chart={charts[i]} onLoad={birth => {
        const chart = generateChart(birth);
        setCharts(prev => i === 0 ? [chart, prev[1]] : [prev[0], chart]);
        setForms(prev => i === 0 ? [undefined, prev[1]] : [prev[0], undefined]);
        setSavedForms(prev => i === 0 ? [undefined, prev[1]] : [prev[0], undefined]);
        setEditing(prev => i === 0 ? [false, prev[1]] : [prev[0], false]);
        setConfirmed(false); setShowAI(false);
      }} />
      {charts[i] && !savedForms[i] && <p className="text-xs">档案按已保存时辰直接排盘；若要编辑，请重新输入原始出生信息，避免把时辰推测为精确钟表时间。</p>}
    </section>)}</div>
    {error && <p role="alert">{error}</p>}
    {!ready && <p>请分别完成双方排盘；编辑时先保存或取消，避免展示过期合盘。</p>}
    {ready && <section className="space-y-4" aria-label="合盘结果">
      <h2 className="text-xl">十二宫结构对照</h2>
      {(a?.birthInfo.birthTimeUnknown || b?.birthInfo.birthTimeUnknown) && <p role="alert">至少一方时辰未知，以下仅为子时示例，不能用于精确合盘。</p>}
      <p className="text-sm">主星重合度 = 同名宫的共同主星数 ÷ 主星并集数。空宫均为空时不计分，不借对宫计分。这是结构相似度，不是感情匹配、婚姻成功率或命运判断。</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">宫位</th><th>甲方主星</th><th>乙方主星</th><th>结构重合</th></tr></thead><tbody>{sections.map(row => <tr key={row.palace} className="border-t"><th className="p-2">{row.palace}</th><td>{row.a.major.join('、') || '空宫'}</td><td>{row.b.major.join('、') || '空宫'}</td><td>{row.score === null ? '不计分' : `${row.score}%`}</td></tr>)}</tbody></table></div>
      <p className="text-sm">{PAIR_ANALYSIS_NOTICE}</p>
      <div className="space-y-3" aria-label="逐宫双盘研究">{sections.map(section => <details key={section.id} className="card-glass p-4 rounded-xl">
        <summary className="cursor-pointer font-semibold">{section.title} · {section.score === null ? '不计分' : `主星重合 ${section.score}%`}</summary>
        <div className="space-y-3 mt-3 text-sm">
          {section.warnings.map(warning => <p key={warning} role="note">注意：{warning}</p>)}
          <h3 className="font-semibold">盘面事实（各自命盘）</h3>
          <div className="grid md:grid-cols-2 gap-3">{([['甲方', section.a], ['乙方', section.b]] as const).map(([label, evidence]) => <section key={label}>
            <h4>{label}</h4><p>{evidence.detail}</p>
            <ul className="mt-2 space-y-1">{evidence.network.map(p => <li key={p.relation}>{p.relation}：{p.palace}（{BRANCHES[p.branch]}）· {p.major.join('、') || '无主星'}；四化 {p.hua.join('、') || '无记录'}</li>)}</ul>
          </section>)}</div>
          <h3 className="font-semibold">集合算术（不是适婚评分）</h3>
          {section.arithmetic.map(line => <p key={line}>{line}</p>)}
          <h3 className="font-semibold">主题参照与研究问题</h3><p>{section.themeBasis}</p>
          <ul className="list-disc pl-5">{section.questions.map(question => <li key={question}>{question}</li>)}</ul>
          {section.sources.map(source => <p className="text-xs" key={source.href}><a className="underline" href={source.href}>{source.title}</a>：{source.scope}</p>)}
        </div>
      </details>)}</div>
      <div className="flex gap-3 flex-wrap"><button type="button" className="border rounded px-3 py-2" onClick={download}>下载完整对照报告</button><button type="button" className="border rounded px-3 py-2" onClick={() => setShowBoards(v => !v)}>{showBoards ? '收起' : '展开'}双方命盘</button></div>
      {showBoards && <div className="grid xl:grid-cols-2 gap-4"><section><h3>甲方</h3><ChartBoard chart={a!} /></section><section><h3>乙方</h3><ChartBoard chart={b!} /></section></div>}
      <label className="block text-sm"><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); if (!e.target.checked) setShowAI(false); }} /> 我已取得双方同意，允许将双方命盘与问题发给我自行配置的模型服务（开启设置不自动发送）</label>
      <button type="button" disabled={!confirmed} className="border rounded px-3 py-2 disabled:opacity-40" onClick={() => setShowAI(v => !v)}>{showAI ? '关闭 AI 问答' : '开启自带模型合盘问答'}</button>
      {showAI && confirmed && <ChatPanel key={report} chart={a!} context={report} historyKey={JSON.stringify([chartId(a!), chartId(b!)])} />}
    </section>}
  </main>;
}
