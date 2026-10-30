'use client';
import { useEffect, useRef, useState } from 'react';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { deleteProfile, exportBackup, importBackup, listProfiles, saveProfile, type LocalProfile } from '@/lib/local-store';
export default function LocalArchives({ chart, onLoad }: { chart?: ZiweiChart | null; onLoad: (birth: BirthInfo) => void }) {
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const refresh = async () => setProfiles(await listProfiles());
  useEffect(() => { refresh().catch(e => setStatus(e.message)); }, []);
  async function run(action: () => Promise<void>, success: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); await refresh(); setStatus(success); } catch (e) { setStatus(e instanceof Error ? e.message : '操作失败'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <details className="card-glass p-4 my-4">
    <summary className="cursor-pointer">本地档案与备份（{profiles.length}）</summary>
    <p className="text-xs my-2">档案、问答只保存在当前浏览器 IndexedDB。清除浏览器数据会丢失记录；备份含私人出生信息和问答，请妥善保管，不含 API Key。本地数据上限 5 MB（档案与会话各最多 1000 条），单会话最多 200 条消息。恢复会合并记录，同一记录以备份覆盖。</p>
    <div className="flex gap-3 flex-wrap my-3">
      {chart && <button disabled={busy} onClick={() => run(() => saveProfile(chart.birthInfo), '当前命盘已保存')}>保存当前命盘</button>}
      <button disabled={busy} onClick={() => run(async () => {
        const text = await exportBackup(); const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `ziwei-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, '备份已导出')}>导出备份</button>
      <label>导入备份 <input type="file" accept=".json,application/json" disabled={busy} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setStatus('备份过大（上限 5 MB）'); return; }
        if (!window.confirm('导入将合并档案和问答；相同记录会被备份覆盖。继续？')) return;
        run(async () => { await importBackup(await file.text()); window.dispatchEvent(new Event('ziwei-local-restored')); }, '备份恢复成功');
      }} /></label>
    </div>
    <p role="status" className="text-sm">{status}</p>
    <ul>{profiles.map(p => <li className="flex gap-3 my-2" key={p.id}>
      <button disabled={busy} onClick={() => { try { onLoad(p.birth); setStatus('已加载档案'); } catch (e) { setStatus(e instanceof Error ? e.message : '加载失败'); } }}>{p.birth.name || '未命名'} · {p.birth.year}-{p.birth.month}-{p.birth.day} · {p.birth.gender === 'male' ? '男' : '女'} · 时辰 {p.birth.hour}</button>
      <button aria-label={`删除${p.birth.name || '未命名'}档案`} disabled={busy} onClick={() => { if (window.confirm('仅删除此出生档案？问答仍在备份中保留。')) run(() => deleteProfile(p.id), '档案已删除'); }}>删除</button>
    </li>)}</ul>
  </details>;
}
