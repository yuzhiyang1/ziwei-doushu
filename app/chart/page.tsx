'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import PrintableReport from '@/components/PrintableReport';
import LocalDatasetPanel from '@/components/LocalDatasetPanel';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import ChatPanel from '@/components/ChatPanel';
import LocalArchives from '@/components/LocalArchives';
import LocalSimilarity from '@/components/LocalSimilarity';
import ShareCardCanvas,{captureShareCard,downloadDataURL} from '@/components/ShareCardCanvas';
import { generateLocalChart } from '@/lib/local-chart';
import LocalSchoolSettings from '@/components/LocalSchoolSettings';
import { defaultTimeSelection,resolveTimeContext,type TimeSelection } from '@/lib/local-time';
import { buildPeriodAnalysis, formatPeriodReport } from '@/lib/local-period-analysis';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
export default function ChartPage() {
 const [chart,setChart]=useState<ZiweiChart|null>(null); const [selectedPalace,setSelectedPalace]=useState<Palace|null>(null);
 const [selection,setSelection]=useState<TimeSelection>(()=>defaultTimeSelection()); const [message,setMessage]=useState('');const [capturing,setCapturing]=useState(false);const lock=useRef(false);
 const load=(birth:BirthInfo)=>{try{const c=generateLocalChart(birth);setChart(c);setSelection(defaultTimeSelection(c));setSelectedPalace(null);setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'排盘失败');}};
 const context=chart?resolveTimeContext(chart,selection):null;
 const report=()=>{if(!chart)return;const blob=new Blob([formatPeriodReport(chart,selection,context??undefined)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);downloadDataURL(url,'紫微个人研究报告.txt');setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const png=async()=>{if(lock.current)return;lock.current=true;setCapturing(true);try{const data=await captureShareCard();if(!data)throw new Error('PNG生成失败，请重试');downloadDataURL(data,'紫微本命盘.png');setMessage('本命盘 PNG 已生成；运限解读请导出报告。');}catch(e){setMessage(e instanceof Error?e.message:'导出失败');}finally{lock.current=false;setCapturing(false);}};
 return <><main className="local-shell local-workspace"><nav className="local-toolbar"><Link href="/">← 研究室</Link><Link href="/heming">双人合盘</Link><Link href="/library">古籍摘编研读</Link><Link href="/study">三纪研读</Link><Link href="/datasets">公开数据集</Link></nav><h1>个人命盘</h1><p>计算与保存均在本地；解读是公开规则的研究性说明，不是商业专属断语。请先导出备份再清理浏览器数据。</p><LocalArchives chart={chart} onLoad={load}/><p role="status">{message}</p>{!chart?<BirthForm onSubmit={load}/>:<>
 {chart.birthInfo.birthTimeUnknown && <p role="alert">出生时辰不详：当前仅以子时作示例；命宫、身宫、合盘与所有运限结果不可视为确定结果。</p>}<div className="local-toolbar"><button onClick={()=>{setChart(null);setSelectedPalace(null);setMessage('');}}>← 重新起盘</button><button onClick={report}>导出文本报告</button><button disabled={capturing} onClick={png}>{capturing?'生成中…':'导出本命 PNG'}</button><button onClick={()=>window.print()}>打印 / 保存 PDF</button></div>
 <div className="local-chart-grid"><ChartBoard key={JSON.stringify(chart.birthInfo)} chart={chart} selection={selection} onSelectionChange={setSelection} onPalaceSelect={setSelectedPalace}/><InsightPanel chart={chart} selectedPalace={selectedPalace} selection={selection} timeContext={context!}/></div>
 <LocalSchoolSettings birth={chart.birthInfo} onChange={c=>{setChart(c);setSelectedPalace(null);}}/><LocalSimilarity chart={chart}/><LocalDatasetPanel chart={chart} onLoad={load}/><section className="local-card"><ChatPanel key={JSON.stringify(chart.birthInfo)} chart={chart} historyKey={selection.view==='mingpan'?'natal':JSON.stringify(selection)} context={JSON.stringify({chart,selection,timeContext:context,analysis:buildPeriodAnalysis(chart,selection,context??undefined),notice:"算术盘面事实与独立传统象征说明须区分，不作确定预测"})}/></section>
 <section className="local-card"><h2>本命分享卡预览（原始钟表时间；无原始输入则显示所存排盘参数）</h2><div style={{overflowX:'auto'}}><ShareCardCanvas chart={chart} birth={{year:String(chart.birthInfo.origInput?.year??chart.birthInfo.year),month:String(chart.birthInfo.origInput?.month??chart.birthInfo.month),day:String(chart.birthInfo.origInput?.day??chart.birthInfo.day),hour:String(chart.birthInfo.origInput?.clockHour??chart.birthInfo.hour*2),minute:String(chart.birthInfo.origInput?.clockMinute??0),gender:chart.birthInfo.gender,city:chart.birthInfo.city}} highlight={chart.birthInfo.birthTimeUnknown?'时辰未知 · 子时示例不可作确定结论':'独立个人版 · 仅供文化研究'}/></div></section>
 </>}</main>{chart&&<PrintableReport chart={chart} selection={selection} timeContext={context?.description}/>}</>;
}
