'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import {useTheme} from '@/components/ThemeProvider';
import PrintableReport from '@/components/PrintableReport';
import LocalDatasetPanel from '@/components/LocalDatasetPanel';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import ChatPanel from '@/components/ChatPanel';
import LocalArchives from '@/components/LocalArchives';
import LocalSimilarity from '@/components/LocalSimilarity';
import ShareCardCanvas,{captureShareCard,downloadDataURL} from '@/components/ShareCardCanvas';
import {generateLocalChart} from '@/lib/local-chart';
import LocalSchoolSettings from '@/components/LocalSchoolSettings';
import {defaultTimeSelection,resolveTimeContext,TIME_LABELS,type TimeSelection} from '@/lib/local-time';
import {buildPeriodAnalysis,formatPeriodReport} from '@/lib/local-period-analysis';
import {buildReadableAnalysis} from '@/lib/local-readable-analysis';
import {BRANCHES} from '@/lib/ziwei/constants';
import type {BirthInfo,ZiweiChart,Palace} from '@/lib/ziwei/types';
export default function ChartPage(){
 const {theme,toggle}=useTheme();const [chart,setChart]=useState<ZiweiChart|null>(null),[selectedPalace,setSelectedPalace]=useState<Palace|null>(null);
 const [selection,setSelection]=useState<TimeSelection>(()=>defaultTimeSelection()),[message,setMessage]=useState(''),[capturing,setCapturing]=useState(false),[view,setView]=useState<'analysis'|'chart'|'ai'>('analysis');const lock=useRef(false);
 const load=(birth:BirthInfo)=>{try{const c=generateLocalChart(birth);setChart(c);setSelection(defaultTimeSelection(c));setSelectedPalace(null);setView('analysis');setMessage('命盘与十三维分析已生成');window.scrollTo({top:0,behavior:'smooth'});}catch(e){setMessage(e instanceof Error?e.message:'排盘失败');}};
 const context=chart?resolveTimeContext(chart,selection):null;
 const report=()=>{if(!chart)return;const readings=buildReadableAnalysis(chart,selection,context??undefined);const text=readings.map(r=>`## ${r.title}\n${r.headline}\n${r.summary}\n特点：${r.strengths.join('；')}\n留意：${r.watchouts.join('；')}\n建议：${r.suggestions.join('；')}`).join('\n\n')+'\n\n'+formatPeriodReport(chart,selection,context??undefined);const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));downloadDataURL(url,'紫微个人研究报告.txt');setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const png=async()=>{if(lock.current)return;lock.current=true;setCapturing(true);try{const data=await captureShareCard();if(!data)throw new Error('PNG生成失败，请重试');downloadDataURL(data,'紫微本命盘.png');setMessage('本命盘 PNG 已生成');}catch(e){setMessage(e instanceof Error?e.message:'导出失败');}finally{lock.current=false;setCapturing(false);}};
 return <><div className="chart-app local-workspace"><header className="workspace-header"><Link className="brand" href="/">紫微<span>个人研究室</span></Link><nav><Link href="/heming">合盘</Link><Link href="/study">研读</Link><Link href="/library">摘编</Link></nav><button className="theme-button" onClick={toggle} aria-label="切换明暗主题">{theme==='dark'?'浅色':'深色'}</button></header>
 {!chart?<main className="onboarding"><div className="onboarding-copy"><span className="eyebrow">01 / 出生信息</span><h1>从命盘开始，<br/>读懂每一个主题。</h1><p>输入出生信息，即刻得到命盘与十三维分析。<br/>无需注册，也无需先配置 AI。</p><div className="onboarding-steps"><span>1 输入出生信息</span><span>2 直接阅读分析</span><span>3 按需连接自己的 AI</span></div><p className="muted">数据保存在此浏览器，只有你主动同意才会发送到模型服务。传统文化研究，不作事实预测。</p><LocalArchives chart={chart} onLoad={load}/></div><div className="birth-card"><BirthForm onSubmit={load}/><p role="status">{message}</p></div></main>:<main className="chart-main">
 <div className="workspace-title"><div><span className="eyebrow">个人命盘</span><h1>{chart.birthInfo.name||'你的命盘'}<span>{chart.birthInfo.year}.{String(chart.birthInfo.month).padStart(2,'0')}.{String(chart.birthInfo.day).padStart(2,'0')} · {chart.birthInfo.gender==='male'?'男':'女'} · {chart.wuxingJuName}</span></h1></div><div className="workspace-actions"><button onClick={()=>{setChart(null);setSelectedPalace(null);setMessage('');}}>← 重新起盘</button><button onClick={report}>导出文本报告</button><button disabled={capturing} onClick={png}>{capturing?'生成中…':'导出本命 PNG'}</button><button onClick={()=>window.print()}>打印 / 保存 PDF</button></div></div>
 <div className="workspace-utility"><LocalArchives chart={chart} onLoad={load}/><p role="status">{message}</p></div>
 {chart.birthInfo.birthTimeUnknown&&<p role="alert" className="unknown-notice">时辰未知：当前仅用子时示例，命盘与分析不可视为准确出生盘。</p>}
 <div className="workspace-tabs" aria-label="工作区视图"><button className="mobile-chart-tab" aria-pressed={view==='chart'} onClick={()=>setView('chart')}>命盘</button><button aria-pressed={view==='analysis'} onClick={()=>setView('analysis')}>命盘分析</button><button aria-pressed={view==='ai'} onClick={()=>setView('ai')}>AI 深问</button><span>本地分析已就绪，不依赖 API Key</span></div>
 <div className="chart-reading-layout" data-view={view}><aside className="chart-pane"><ChartBoard key={JSON.stringify(chart.birthInfo)} chart={chart} selection={selection} onSelectionChange={setSelection} onPalaceSelect={p=>{setSelectedPalace(p);if(p)setView('analysis');}}/><p className="chart-tip">点选任意宫位，右侧查看对应分析。</p></aside><div className="reading-pane"><div hidden={view==='ai'}><div className="mobile-period"><label>分析时序<select aria-label="分析时序" value={selection.view} onChange={e=>setSelection({...selection,view:e.target.value as TimeSelection['view']})}>{Object.entries(TIME_LABELS).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><span>{selection.view==='mingpan'?'本命分析':selection.view==='daxian'?`${chart.daXians[selection.daXianIndex]?.startAge}–${chart.daXians[selection.daXianIndex]?.endAge}虚岁`:`${selection.date} ${BRANCHES[selection.hour]}时`}</span></div><InsightPanel chart={chart} selectedPalace={selectedPalace} selection={selection} timeContext={context!} onAskAI={()=>setView('ai')}/></div><div hidden={view!=='ai'} className="ai-pane"><h2>带着命盘，继续深入</h2><p>本地十三维分析始终免费可读。这里是可选的自带模型问答，需填写你自己的 Key。</p><ChatPanel key={JSON.stringify(chart.birthInfo)} chart={chart} historyKey={selection.view==='mingpan'?'natal':JSON.stringify(selection)} context={JSON.stringify({chart,selection,timeContext:context,analysis:buildPeriodAnalysis(chart,selection,context??undefined),readable:buildReadableAnalysis(chart,selection,context??undefined)})}/></div></div></div>
 <details className="workspace-tools"><summary>高级工具 · 流派、相似盘与公开数据</summary><p>这些工具不影响上方直接阅读命盘分析，按需展开使用。</p><LocalSchoolSettings birth={chart.birthInfo} onChange={c=>{setChart(c);setSelectedPalace(null);}}/><LocalSimilarity chart={chart}/><LocalDatasetPanel chart={chart} onLoad={load}/></details>
 <div className="share-render-only" aria-hidden="true"><ShareCardCanvas chart={chart} birth={{year:String(chart.birthInfo.origInput?.year??chart.birthInfo.year),month:String(chart.birthInfo.origInput?.month??chart.birthInfo.month),day:String(chart.birthInfo.origInput?.day??chart.birthInfo.day),hour:String(chart.birthInfo.origInput?.clockHour??chart.birthInfo.hour*2),minute:String(chart.birthInfo.origInput?.clockMinute??0),gender:chart.birthInfo.gender,city:chart.birthInfo.city}} highlight={chart.birthInfo.birthTimeUnknown?'时辰未知 · 子时示例':'个人本地版 · 文化研究'}/></div>
 </main>}</div>{chart&&<PrintableReport chart={chart} selection={selection} timeContext={context?.description}/>}</>;
}
