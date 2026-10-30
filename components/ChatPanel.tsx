'use client';
import { useEffect, useRef, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { chartId, loadChat, saveChat, type LocalMessage } from '@/lib/local-store';
import { askAI, validateEndpoint } from '@/lib/local-ai';

export default function ChatPanel({ chart, context, historyKey }: { chart: ZiweiChart; context?: string; historyKey?: string }) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1/chat/completions');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const id = chartId(chart, historyKey);
  useEffect(() => {
    const restored = () => { ++epoch.current; controller.current?.abort(); setRestoreVersion(value => value + 1); };
    window.addEventListener('ziwei-local-restored', restored);
    return () => window.removeEventListener('ziwei-local-restored', restored);
  }, []);
  useEffect(() => {
    const version = ++epoch.current;
    controller.current?.abort(); controller.current = null; setLoading(false); setReady(false); setMessages([]); setConsent(false); setStatus('');
    loadChat(chart, historyKey).then(history => { if (version === epoch.current) setMessages(history); }).catch(e => { if (version === epoch.current) setStatus(e.message); }).finally(() => { if (version === epoch.current) setReady(true); });
    return () => { ++epoch.current; controller.current?.abort(); };
  // History identity excludes mutable report text and current age. Context changes still cancel stale requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, context, restoreVersion]);
  async function persist(next: LocalMessage[], version = epoch.current) {
    if (version === epoch.current) setMessages(next);
    try { await saveChat(chart, next, historyKey); } catch (e) { if (version === epoch.current) setStatus(`问答未能保存：${e instanceof Error ? e.message : '存储失败'}`); }
  }
  async function send() {
    if (controller.current || !input.trim() || !consent || !ready) return;
    if (messages.length >= 198) { setStatus('本会话已达 200 条上限，请先导出备份并清空会话'); return; }
    try { validateEndpoint(endpoint); if (!model.trim()) throw new Error('请填写模型名称'); } catch (e) { setStatus(e instanceof Error ? e.message : '配置错误'); return; }
    const abort = new AbortController(), version = epoch.current;
    controller.current = abort; setLoading(true); setStatus('');
    const next: LocalMessage[] = [...messages, { role: 'user', content: input.trim() }];
    setInput(''); await persist(next, version);
    if (version !== epoch.current || abort.signal.aborted) {
      if (controller.current === abort) { controller.current = null; setLoading(false); setStatus('请求已取消'); }
      return;
    }
    const timeout = setTimeout(() => abort.abort(), 90000);
    try {
      const result = await askAI({ endpoint, model, apiKey }, context ?? chart, next, abort.signal);
      if (version === epoch.current && !abort.signal.aborted) await persist([...next, { role: 'assistant', content: result }], version);
    } catch (e) {
      if (version === epoch.current) setStatus(abort.signal.aborted ? '请求已取消或超过 90 秒；未保存未完成回答。' : `${e instanceof Error ? e.message : '请求失败'}。浏览器直连要求服务支持 CORS；本工具没有代理后端。`);
    } finally { clearTimeout(timeout); if (controller.current === abort) { controller.current = null; setLoading(false); } }
  }
  return <section className="card-glass p-4 my-4" aria-label="自带模型问答">
    <h2 className="text-lg">自带模型问答</h2>
    <p className="text-xs my-2">独立学习助手，不是官网专业版 AI。需自行配置兼容 OpenAI Chat Completions 的服务（完整接口 URL），模型服务可能收费。API Key 仅在本页面内存中，刷新后清除，不写入备份。浏览器直连受 CORS 限制；本机模型可不填 Key。</p>
    <details><summary>模型连接设置</summary><div className="grid gap-2 my-3">
      <label>API 地址 <input aria-label="API 地址" className="w-full" value={endpoint} disabled={loading} onChange={e => { setEndpoint(e.target.value); setConsent(false); }} /></label>
      <label>模型名称 <input aria-label="模型名称" value={model} disabled={loading} onChange={e => setModel(e.target.value)} placeholder="填写服务提供的模型 ID" /></label>
      <label>API Key <input aria-label="API Key" type="password" autoComplete="off" value={apiKey} disabled={loading} onChange={e => setApiKey(e.target.value)} /></label>
    </div></details>
    <label className="block text-sm my-3"><input type="checkbox" checked={consent} disabled={loading} onChange={e => setConsent(e.target.checked)} /> 我同意将此命盘（合盘时含双方资料）、问题及本会话历史发送到上方 API 地址；已取得涉及他人的授权。</label>
    <div className="space-y-3 max-h-96 overflow-auto" aria-live="polite">{messages.map((m, i) => <div key={i} className="whitespace-pre-wrap text-sm border-b pb-2"><strong>{m.role === 'user' ? '我' : '模型'}：</strong>{m.content}</div>)}</div>
    <textarea aria-label="问答问题" className="w-full my-3 p-2" maxLength={4000} value={input} disabled={loading || !ready} onChange={e => setInput(e.target.value)} placeholder="输入文化学习问题（不作现实决策依据）" />
    <div className="flex gap-4"><button disabled={loading || !consent || !input.trim() || !ready} onClick={send}>发送问题</button>
      {loading && <button onClick={() => controller.current?.abort()}>取消请求</button>}
      <button disabled={loading || !ready || !messages.length} onClick={() => { if (window.confirm('清空当前问答？建议先导出备份。')) persist([]); }}>清空问答</button>
    </div>
    <p role="status" className="text-sm my-2">{status}</p>
  </section>;
}
