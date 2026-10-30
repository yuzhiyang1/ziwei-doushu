'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES } from '@/lib/ziwei/constants';
import manifest from '@/lib/dataset-manifest.json';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from '@/lib/local-chart';
import { deleteDatasetYear, findDatasetMatches, importDatasetFile, listDatasetYears, readDatasetReport, type DatasetMatch, type DatasetProgress, type DatasetReport, type DatasetYear } from '@/lib/local-dataset';

const RELEASE='https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d';
const ASSETS='https://github.com/Renhuai123/ziwei-doushu/releases/download/v4.0-13d';
const ATTRIBUTION='来源：王多鱼AI · Renhuai123/ziwei-doushu，公开解读数据集 v4.0-13d，CC BY 4.0。倪海厦《天纪》引用文字的权利不包含在数据集授权内；批量再使用请另核对原话目录 CC BY-NC-SA 4.0 与原权利人要求。';
function birthLabel(b:BirthInfo) { return `${b.year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')} ${BRANCHES[b.hour]}时 ${b.gender==='male'?'男':'女'}`; }
function expectedYearRows(year:number){return (new Date(Date.UTC(year,1,29)).getUTCMonth()===1?366:365)*24;}
function megabytes(bytes:number) { return (bytes/1024/1024).toFixed(1); }
export default function LocalDatasetPanel({chart,onLoad}:{chart?:ZiweiChart|null;onLoad?:(birth:BirthInfo)=>void}) {
 const [years,setYears]=useState<DatasetYear[]>([]),[downloadYear,setDownloadYear]=useState(1990);
 const [matches,setMatches]=useState<DatasetMatch[]>([]),[report,setReport]=useState<DatasetReport|null>(null);
 const [progress,setProgress]=useState<DatasetProgress|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[cancellable,setCancellable]=useState(true);
 const controller=useRef<AbortController|null>(null), mounted=useRef(true);
 const birthKey=chart?JSON.stringify(chart.birthInfo):'';
 const matchBirth=useMemo(()=>chart?generateLocalChart({...chart.birthInfo,schoolConfig:{...LOCAL_SCHOOL_DEFAULTS}},{...LOCAL_SCHOOL_DEFAULTS}).birthInfo:null,[birthKey]);
 const refresh=async()=>{const value=await listDatasetYears();if(mounted.current)setYears(value);};
 useEffect(()=>{mounted.current=true;refresh().catch(e=>{if(mounted.current)setStatus(e instanceof Error?e.message:'无法读取本地数据索引');});return()=>{mounted.current=false;controller.current?.abort();};},[]);
 useEffect(()=>{controller.current?.abort();setMatches([]);setReport(null);setStatus('');if(chart && chart.birthInfo.year>=1950 && chart.birthInfo.year<=2026)setDownloadYear(chart.birthInfo.year);},[birthKey]); // Different natal chart must never retain another person's result.
 // A successful Worker reply means the atomic commit completed, even if cancel arrived during cleanup.
 async function run(action:(signal:AbortSignal,onProgress:(p:DatasetProgress)=>void)=>Promise<string>, canCancel=true) {
  if(controller.current)return;
  const task=new AbortController();controller.current=task;setBusy(true);setCancellable(canCancel);setProgress(null);setStatus('');
  try {const message=await action(task.signal,p=>{if(mounted.current&&!task.signal.aborted)setProgress(p);});if(mounted.current)setStatus(message);}
  catch(error){if(mounted.current)setStatus(task.signal.aborted?'操作已取消；未完成的导入不会替换原有年度索引。':error instanceof Error?error.message:'操作失败，请检查文件与浏览器可用存储空间。');}
  finally {try{await refresh();}catch{/* Keep the original error instead of masking it. */}if(controller.current===task)controller.current=null;if(mounted.current){setBusy(false);setProgress(null);}}
 }
 const validFile=(file?:File)=>{if(!file)return false;if(!file.name.toLowerCase().endsWith('.jsonl')){setStatus('请选择解压后的 .jsonl 文件，不是 .zst 或 .tar；浏览器不会自动解压。');return false;}return true;};
 const selectedManifest=manifest.files.find(row=>row.year===downloadYear);
 const percent=progress && progress.totalBytes>0?Math.min(100,Math.floor(progress.bytes/progress.totalBytes*100)):0;
 const canQuery=!!chart && !chart.birthInfo.birthTimeUnknown;
 const inRange=!!chart && chart.birthInfo.year>=1950&&chart.birthInfo.year<=2026;
 return <section className="local-card" aria-label="公开数据集与本地匹配">
  <h2>公开 v4 数据集 · 按年本地使用</h2>
  <p>无需 API Key、登录或后端。只有你主动选择的本地文件会被读取；出生信息不上传，也不调用模型。当前已导入 <strong data-testid="dataset-count">{years.length} 年 / {years.reduce((n,y)=>n+y.count,0).toLocaleString()} 条索引</strong>，不是默认装有全部命盘。</p>
  <p>这是 1950–2026 年的公开预生成<strong>本命</strong>十三维文本，不是各流层报告，也不等于官网全部现行断语。v4 使用旧 XD2 亮度口径、没有出生地真太阳时校正；查询以当前已校正的<strong>排盘日期与时辰</strong>为键。非默认流派、闰月归属或时辰口径可能与源报告不同，匹配键相同也不保证所有安星细节相同。</p>
  <details><summary>下载、解压与许可说明</summary>
   <p>只下载需要的单年文件：通常压缩约 2 MB，解压约 700 MB。请为解压预留足够磁盘空间；不要为使用本页解压约 57 GB 的全量包。</p>
   <div className="local-toolbar"><label>下载年份 <select aria-label="数据集下载年份" value={downloadYear} onChange={e=>setDownloadYear(Number(e.target.value))}>{Array.from({length:77},(_,i)=>1950+i).map(y=><option key={y}>{y}</option>)}</select></label><a href={`${ASSETS}/year-${downloadYear}.jsonl.zst`} target="_blank" rel="noreferrer">下载 year-{downloadYear}.jsonl.zst</a><a href={RELEASE} target="_blank" rel="noreferrer">官方发布页 / 文件校验清单</a></div>
   <p>在本机安装 zstd 后，于下载目录运行以下命令；长窗口选项不可省略。然后选生成的 <code>.jsonl</code> 文件，不能直接选择压缩包。</p>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{`zstd -d --long=27 year-${downloadYear}.jsonl.zst`}</pre>
   <details><summary>Windows / macOS 操作步骤</summary><p>Windows：仅从 <a href="https://github.com/meta/zstd/releases" target="_blank" rel="noreferrer">Zstandard 官方 Releases</a> 获取适合系统的 Windows 压缩包，解压后将 zstd.exe 与年度 .zst 文件放在同一文件夹，在该文件夹打开 PowerShell：</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{`Get-FileHash .\\year-${downloadYear}.jsonl.zst -Algorithm SHA256
.\\zstd.exe -d --long=27 .\\year-${downloadYear}.jsonl.zst`}</pre><p>macOS：若已经使用 Homebrew，可按 <a href="https://formulae.brew.sh/formula/zstd" target="_blank" rel="noreferrer">官方 formula</a> 执行 brew install zstd；或按 Zstandard 官方源码说明安装。终端进入下载文件夹：</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{`cd ~/Downloads
shasum -a 256 year-${downloadYear}.jsonl.zst
zstd -d --long=27 year-${downloadYear}.jsonl.zst`}</pre><p>先比较校验值，再解压。我们不会替你安装软件；不要从不明下载站获取可执行文件。选出的 JSONL 仍只在本地浏览器读取。</p></details>
   <p>官方清单标注：{selectedManifest?.charts.toLocaleString()} 条，压缩 {selectedManifest?megabytes(selectedManifest.zstBytes):'?'} MB。先用 <code>shasum -a 256 year-{downloadYear}.jsonl.zst</code> 检查结果与以下 SHA-256 一致，再解压：</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{selectedManifest?.sha256}</pre><p>校验值来自官方 MANIFEST.json，内容版本 {manifest.contentVersion}，生成日期 {manifest.generatedAt}。本工具不会把出生资料发给下载网站。</p><p>{ATTRIBUTION}</p>
  </details>
  <h3>1. 导入结构索引</h3>
  <p>Web Worker 分段读取，不把约 700 MB 全文放入内存或 IndexedDB；仅保存用于查找相似盘的紧凑结构索引。按日期/时辰/性别键去重校验；完整年应为8760条（闰年8784条），不足时明确标为部分样本。整份文件校验完成后才原子替换同年索引；取消或错误会保留旧版本。原始 JSONL 请保留，读取全文时需再次选择。浏览器清理数据会删除索引；个人档案备份不包含此公开索引，删除后可重新导入。</p>
  <label>选择解压后的年度 JSONL <input aria-label="导入公开年度JSONL" type="file" accept=".jsonl,application/x-ndjson" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!validFile(file))return;run(async(signal,onProgress)=>{const imported=await importDatasetFile(file!,signal,onProgress);if(mounted.current)setMatches([]);return `导入完成：${imported.map(y=>`${y.year} 年 ${y.count} 条`).join('；')}`;});}}/></label>
  {busy && <div aria-live="polite"><p>{progress?`${({reading:'读取',indexing:'建立索引',searching:'搜索',report:'读取报告'} as const)[progress.phase]}：${progress.rows.toLocaleString()} 条，${megabytes(progress.bytes)} / ${megabytes(progress.totalBytes)} MB`:'正在准备…'}</p>{progress && <progress aria-label="数据处理进度" max={100} value={percent}/>}<button type="button" disabled={!cancellable} onClick={()=>controller.current?.abort()}>取消数据操作</button></div>}
  <p role="status" data-testid="dataset-status">{status}</p>
  {years.length===0?<p>尚未导入任何公开数据。其他排盘、原创规则与古籍功能仍可使用。</p>:<ul>{years.map(y=><li key={y.year} className="local-toolbar"><span>{y.year} 年 · {y.count.toLocaleString()} / {expectedYearRows(y.year).toLocaleString()} 条 · {y.count===expectedYearRows(y.year)?'完整年份':'部分样本（非完整年）'} · {y.fileName}</span><button type="button" disabled={busy} aria-label={`删除${y.year}年数据索引`} onClick={()=>{if(window.confirm(`删除 ${y.year} 年公开索引？不会删除你的出生档案或磁盘上的 JSONL 文件。`))run(async()=>{await deleteDatasetYear(y.year);if(mounted.current)setMatches([]);return `${y.year} 年索引已删除`;},false);}}>删除此年索引</button></li>)}</ul>}
  <h3>2. 在已导入样本中匹配</h3>
  {!chart?<p>先在“个人命盘”生成或加载命盘，然后在命盘页使用匹配与全文查询。</p>:<>
   <p>当前显示命盘 / 精确报告查找键：{birthLabel(chart.birthInfo)}。</p><p>按数据集口径重排后匹配：{matchBirth?birthLabel(matchBirth):'—'}。这不是直接匹配当前自定义盘；先将原始出生输入按默认流派重新排盘（晚子时换日），再与索引对照。匹配分数以“宫名:主星名”集合的 Jaccard 重合度 ×100 计算；不是官方匹配评分，也不是人生相似率、人格概率或预测结论。</p>
   {chart.birthInfo.birthTimeUnknown && <p role="alert">时辰未知：不进行精确报告查询或公开样本匹配，请先确定时辰。</p>}
   <p>公开报告按上方“精确报告查找键”读取文件，属于用户当前排盘日所选键，不保证与默认重排匹配盘同口径。尤其晚子时、闰月、自选流派不同，请核对两行日期后使用。</p>
   <button type="button" disabled={busy||!canQuery||!years.length} onClick={()=>run(async(signal,onProgress)=>{setMatches([]);const result=await findDatasetMatches(chart,20,signal,onProgress);if(!signal.aborted&&mounted.current)setMatches(result);return result.length?`已匹配 ${result.length} 条；仅搜索已导入年份。`:'已导入样本中没有匹配结果。';})}>匹配已导入样本</button>
   <ol>{matches.map(m=><li key={m.key}><details><summary>{birthLabel(m.birth)} · 结构得分 {m.score}%</summary><p>数据来源：{m.source}；记录键：{m.key}</p>{onLoad && <button type="button" disabled={busy} onClick={()=>{setMatches([]);setReport(null);onLoad(m.birth);}}>载入此样本命盘</button>}</details></li>)}</ol>
   <h3>3. 读取当前盘公开十三维原文</h3>
   <p>再次选择对应年份的原始 JSONL，逐行查找精确日期、时辰、性别记录。无需先建索引；不使用模糊结果冒充当前命盘报告。不存储报告全文，刷新后需重新读取。</p>
   {!inRange && <p role="alert">当前排盘年超出公开 v4 的 1950–2026 范围，无对应原文。</p>}
   <label>选择原文 JSONL <input aria-label="读取公开十三维报告JSONL" type="file" accept=".jsonl,application/x-ndjson" disabled={busy||!canQuery||!inRange} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!validFile(file))return;run(async(signal,onProgress)=>{setReport(null);const found=await readDatasetReport(file!,chart.birthInfo,signal,onProgress);if(!signal.aborted&&mounted.current)setReport(found);return '已找到精确记录。下方为源数据原文，不是本工具新生成的分析。';});}}/></label>
  </>}
  {report && <article aria-label="公开十三维报告"><h3>公开 v4 原文 · {birthLabel(report.birth)}</h3><p>记录：{report.key} · {report.source}{report.generatedAt?` · 生成于 ${report.generatedAt}`:''}</p><p>{ATTRIBUTION}</p><p>源文本为传统术数资料，不应作为医疗、投资或关系决策依据。亮度、时辰和历法口径可能与当前盘不同。</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit',lineHeight:1.8}}>{report.content}</pre><button type="button" onClick={()=>setReport(null)}>关闭公开报告</button></article>}
 </section>;
}
