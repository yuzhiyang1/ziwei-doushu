import type { BirthInfo, ZiweiChart } from './ziwei/types';
import { generateLocalChart, LOCAL_SCHOOL_DEFAULTS } from './local-chart';

export const DATASET_SOURCE = '王多鱼 AI · 紫微斗数 v4 公开数据集（CC BY 4.0；引用原话可能适用 CC BY-NC-SA 4.0）';
export const DATASET_DIMENSIONS = ['overview', 'personality', 'love', 'career', 'wealth', 'health', 'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents'] as const;
export const DATASET_DB = 'ziwei-public-dataset-v1';
export const MAX_DATASET_FILE = 2 * 1024 * 1024 * 1024;
export const MAX_DATASET_LINE = 2 * 1024 * 1024;
export interface DatasetProgress { phase: 'reading' | 'indexing' | 'searching' | 'report'; bytes: number; totalBytes: number; rows: number }
export interface DatasetYear { year: number; count: number; importedAt: number; source: string; fileName: string; version: string }
export interface DatasetMatch { birth: BirthInfo; score: number; source: string; key: string; sourceMingStar: string | null }
export interface DatasetReport { key: string; birth: BirthInfo; content: string; source: string; dimensions: Record<string, string>; generatedAt?: string }
interface DatasetRow { key: string; birth: BirthInfo; sourceMingStar: string | null; dimensions: Record<string, string> }
interface DatasetRecord { version: string; key: string; birth: BirthInfo; signature: string[]; sourceMingStar: string | null }
export interface DatasetFile { size: number; name?: string; stream(): ReadableStream<Uint8Array> }
export type DatasetProgressCallback = (progress: DatasetProgress) => void;
function cancelled(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('操作已取消，旧索引保持不变', 'AbortError'); }
function integer(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max; }
export function datasetKey(birth: BirthInfo): string { return `${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}-${birth.hour}-${birth.gender}`; }
export function parseDatasetRow(text: string): DatasetRow {
  const row = JSON.parse(text) as Record<string, unknown>;
  if (!row || typeof row !== 'object' || Array.isArray(row) || !integer(row.y, 1950, 2026) || !integer(row.m, 1, 12) || !integer(row.d, 1, 31) || !integer(row.h, 0, 11) || (row.g !== 'male' && row.g !== 'female')) throw new Error('v4 出生参数格式无效（支持 1950–2026 年）');
  const date = new Date(Date.UTC(row.y, row.m - 1, row.d));
  if (date.getUTCMonth() !== row.m - 1 || date.getUTCDate() !== row.d) throw new Error('v4 数据含不存在的日期');
  const birth: BirthInfo = { year: row.y, month: row.m, day: row.d, hour: row.h, gender: row.g };
  if (row.k !== datasetKey(birth)) throw new Error('v4 的 k 与出生参数不一致');
  if (row.ms !== null && (typeof row.ms !== 'string' || row.ms.length > 200)) throw new Error('v4 的 ms 格式无效');
  if (!row.c || typeof row.c !== 'object' || Array.isArray(row.c)) throw new Error('v4 缺少 13 维内容对象 c');
  const entries = Object.entries(row.c);
  if (entries.length !== 13 || entries.some(([key, value]) => !DATASET_DIMENSIONS.includes(key as typeof DATASET_DIMENSIONS[number]) || typeof value !== 'string')) throw new Error('v4 的 c 必须包含 13 个文本维度');
  return { key: row.k as string, birth, sourceMingStar: row.ms as string | null, dimensions: Object.fromEntries(entries) as Record<string, string> };
}
export function chartSignature(chart: ZiweiChart): string[] { return chart.palaces.flatMap(p => p.stars.filter(s => s.type === 'major').map(s => `${p.name}:${s.name}`)).sort(); }
export function signatureScore(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a), right = new Set(b); let overlap = 0;
  left.forEach(value => { if (right.has(value)) overlap++; });
  const union = new Set([...left, ...right]).size;
  return union ? Math.round(overlap / union * 10000) / 100 : 0;
}
/** Bounded incremental UTF-8 decoder. Never invokes File.text()/arrayBuffer(). */
export async function* datasetLines(file: DatasetFile, signal?: AbortSignal, progress?: DatasetProgressCallback, phase: DatasetProgress['phase'] = 'reading'): AsyncGenerator<{ text: string; number: number; bytes: number }> {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_DATASET_FILE) throw new Error('请选择非空、未压缩的 JSONL 文件（上限 2 GB）');
  cancelled(signal);
  const reader = file.stream().getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder(); let buffer = '', bytes = 0, number = 0, rows = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      cancelled(signal);
      const { value, done } = await reader.read();
      cancelled(signal);
      if (done) { buffer += decoder.decode(); break; }
      bytes += value.byteLength;
      if (bytes > MAX_DATASET_FILE || bytes > file.size) throw new Error('文件流大小超出声明或 2 GB 上限');
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1); number++;
        if (encoder.encode(line).byteLength > MAX_DATASET_LINE) throw new Error(`第 ${number} 行超过 2 MB 上限`);
        if (line.trim()) { rows++; yield { text: line, number, bytes }; if (rows % 24 === 0) await new Promise(resolve => setTimeout(resolve, 0)); }
        cancelled(signal);
      }
      if (encoder.encode(buffer).byteLength > MAX_DATASET_LINE) throw new Error(`第 ${number + 1} 行超过 2 MB 上限`);
      progress?.({ phase, bytes, totalBytes: file.size, rows });
    }
    if (buffer.trim()) { number++; if (encoder.encode(buffer).byteLength > MAX_DATASET_LINE) throw new Error(`第 ${number} 行超过 2 MB 上限`); rows++; yield { text: buffer.replace(/\r$/, ''), number, bytes }; }
    progress?.({ phase, bytes, totalBytes: file.size, rows });
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('浏览器不支持 IndexedDB 数据集索引'));
    const req = indexedDB.open(DATASET_DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('years')) req.result.createObjectStore('years', { keyPath: 'year' });
      if (!req.result.objectStoreNames.contains('records')) { const store = req.result.createObjectStore('records', { keyPath: ['version', 'key'] }); store.createIndex('version', 'version'); }
      if (!req.result.objectStoreNames.contains('staging')) req.result.createObjectStore('staging', { keyPath: 'version' });
    };
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(new Error('无法打开数据集索引数据库'));
    req.onblocked = () => reject(new Error('数据集数据库被其他标签页占用，请关闭后重试'));
  });
}
function transaction<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, set: (result: T) => void) => void, signal?: AbortSignal): Promise<T> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode); let result: T;
    const abort = () => { try { tx.abort(); } catch { /* already committed */ } };
    signal?.addEventListener('abort', abort, { once: true });
    tx.oncomplete = () => { signal?.removeEventListener('abort', abort); resolve(result); };
    tx.onabort = tx.onerror = () => { signal?.removeEventListener('abort', abort); reject(signal?.aborted ? new DOMException('操作已取消', 'AbortError') : new Error(`数据集存储失败：${tx.error?.message ?? '事务未提交'}`)); };
    try { action(tx, value => { result = value; }); } catch (error) { abort(); reject(error); }
  });
}
async function deleteVersion(db: IDBDatabase, version: string): Promise<void> {
  await transaction<void>(db, ['records', 'staging'], 'readwrite', tx => {
    tx.objectStore('staging').delete(version);
    const req = tx.objectStore('records').index('version').openCursor(IDBKeyRange.only(version));
    req.onsuccess = () => { const cursor = req.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  });
}
/** Reap crashed imports only after a one-hour stale heartbeat, never another live import. */
async function cleanupStaging(db: IDBDatabase): Promise<void> {
  await transaction<void>(db, ['years', 'records', 'staging'], 'readwrite', tx => {
    const years = tx.objectStore('years').getAll(), staging = tx.objectStore('staging').getAll(); let completed = 0;
    const ready = () => {
      if (++completed !== 2) return;
      const active = new Set((years.result as DatasetYear[]).map(item => item.version));
      for (const item of staging.result as { version: string; touchedAt: number }[]) {
        if (active.has(item.version) || item.touchedAt > Date.now() - 3600000) continue;
        const req = tx.objectStore('records').index('version').openCursor(IDBKeyRange.only(item.version));
        req.onsuccess = () => { if (req.result) { req.result.delete(); req.result.continue(); } };
        tx.objectStore('staging').delete(item.version);
      }
    };
    years.onsuccess = staging.onsuccess = ready;
  });
}
export async function listDatasetYearsCore(): Promise<DatasetYear[]> {
  const db = await openDB(); try { return await transaction<DatasetYear[]>(db, ['years'], 'readonly', (tx, set) => { const req = tx.objectStore('years').getAll(); req.onsuccess = () => set(req.result.sort((a: DatasetYear, b: DatasetYear) => a.year - b.year)); }); } finally { db.close(); }
}
export async function deleteDatasetYearCore(year: number): Promise<void> {
  const db = await openDB();
  try {
    await transaction<void>(db, ['years', 'records'], 'readwrite', tx => {
      const years = tx.objectStore('years'), req = years.get(year);
      req.onsuccess = () => {
        const meta = req.result as DatasetYear | undefined; if (!meta) return;
        years.delete(year);
        const cursor = tx.objectStore('records').index('version').openCursor(IDBKeyRange.only(meta.version));
        cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
      };
    });
  } finally { db.close(); }
}
export async function importDatasetFileCore(file: DatasetFile, signal?: AbortSignal, progress?: DatasetProgressCallback): Promise<DatasetYear[]> {
  const db = await openDB(), version = crypto.randomUUID(); let committed = false, year: number | undefined, count = 0;
  const keys = new Set<string>(); let batch: DatasetRecord[] = [], hasFlushed = false;
  const flush = async () => {
    if (!batch.length) return;
    const items = batch; batch = [];
    await transaction<void>(db, ['records', 'staging'], 'readwrite', tx => {
      const staging = tx.objectStore('staging'), existing = staging.get(version);
      existing.onsuccess = () => {
        if (hasFlushed && !existing.result) { tx.abort(); return; } // suspended import was safely reclaimed
        items.forEach(item => tx.objectStore('records').add(item)); staging.put({ version, touchedAt: Date.now() });
      };
    }, signal);
    hasFlushed = true;
  };
  try {
    await cleanupStaging(db);
    for await (const line of datasetLines(file, signal, progress)) {
      let row: DatasetRow;
      try { row = parseDatasetRow(line.text); } catch (error) { throw new Error(`第 ${line.number} 行无效：${error instanceof Error ? error.message : '解析失败'}`); }
      year ??= row.birth.year;
      if (row.birth.year !== year) throw new Error('每次仅支持导入一个年份的 JSONL 文件');
      if (keys.has(row.key)) throw new Error(`重复数据键：${row.key}`);
      keys.add(row.key); count++;
      if (count > 8784) throw new Error('单年记录超过 8784 条上限');
      cancelled(signal);
      const chart = generateLocalChart(row.birth, { ...LOCAL_SCHOOL_DEFAULTS });
      batch.push({ version, key: row.key, birth: row.birth, signature: chartSignature(chart), sourceMingStar: row.sourceMingStar });
      if (batch.length >= 24) await flush();
      progress?.({ phase: 'indexing', bytes: line.bytes, totalBytes: file.size, rows: count });
      // Let worker message events deliver cancellation even when many rows share a chunk.
      if (count % 24 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!count || year === undefined) throw new Error('文件没有可导入的数据行');
    await flush(); cancelled(signal);
    const meta: DatasetYear = { year, count, importedAt: Date.now(), source: DATASET_SOURCE, fileName: file.name ?? 'local.jsonl', version };
    const oldVersion = await transaction<string | undefined>(db, ['years', 'staging'], 'readwrite', (tx, set) => {
      const store = tx.objectStore('years'), req = store.get(meta.year);
      req.onsuccess = () => {
        const old = req.result?.version as string | undefined;
        const staging = tx.objectStore('staging'), pending = staging.get(version);
        pending.onsuccess = () => { if (!pending.result) { tx.abort(); return; } set(old); store.put(meta); staging.delete(version); if (old) staging.put({ version: old, touchedAt: 0 }); };
      };
    }, signal);
    committed = true;
    if (oldVersion) await deleteVersion(db, oldVersion).catch(() => { /* old inactive data can be removed later; active import already committed */ });
    return await listDatasetYearsCore();
  } finally { if (!committed) await deleteVersion(db, version).catch(() => {}); db.close(); }
}
export async function findDatasetMatchesCore(chart: ZiweiChart, limit = 20, signal?: AbortSignal, progress?: DatasetProgressCallback): Promise<DatasetMatch[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('匹配数量应为 1–100');
  const defaultChart = generateLocalChart({ ...chart.birthInfo, schoolConfig: { ...LOCAL_SCHOOL_DEFAULTS } }, { ...LOCAL_SCHOOL_DEFAULTS });
  const signature = chartSignature(defaultChart), db = await openDB(); let rows = 0;
  const best: DatasetMatch[] = [];
  try {
    await transaction<void>(db, ['years', 'records'], 'readonly', tx => {
      const meta = tx.objectStore('years').getAll();
      meta.onsuccess = () => {
        const active = new Set((meta.result as DatasetYear[]).map(item => item.version));
        const req = tx.objectStore('records').openCursor();
        req.onsuccess = () => {
          const cursor = req.result; if (!cursor) return;
          const row = cursor.value as DatasetRecord;
          if (active.has(row.version)) {
            const score = signatureScore(signature, row.signature);
            best.push({ birth: row.birth, key: row.key, score, source: DATASET_SOURCE, sourceMingStar: row.sourceMingStar });
            best.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)); if (best.length > limit) best.pop();
            rows++; if (rows % 100 === 0) progress?.({ phase: 'searching', bytes: 0, totalBytes: 0, rows });
          }
          cursor.continue();
        };
      };
    }, signal);
    progress?.({ phase: 'searching', bytes: 0, totalBytes: 0, rows });
    return best;
  } finally { db.close(); }
}
export async function readDatasetReportCore(file: DatasetFile, birth: BirthInfo, signal?: AbortSignal, progress?: DatasetProgressCallback): Promise<DatasetReport> {
  if (!integer(birth.year, 1950, 2026)) throw new Error('公开 v4 数据仅覆盖 1950–2026 年，当前校正排盘日期不在范围内。');
  const target = datasetKey(birth);
  for await (const line of datasetLines(file, signal, progress, 'report')) {
    let row: DatasetRow;
    try { row = parseDatasetRow(line.text); } catch (error) { throw new Error(`第 ${line.number} 行无效：${error instanceof Error ? error.message : '解析失败'}`); }
    if (row.birth.year !== birth.year) throw new Error(`请选择 ${birth.year} 年 JSONL，当前文件记录属于 ${row.birth.year} 年。`);
    if (row.key === target) return { key: row.key, birth: row.birth, source: DATASET_SOURCE, dimensions: row.dimensions, content: Object.entries(row.dimensions).map(([name, text]) => `## ${name}\n\n${text}`).join('\n\n') };
  }
  throw new Error(`文件中没有 ${target} 的公开报告。请选择对应年份完整 v4 JSONL；采用的是校正后的排盘日期与时辰，不是原始钟表日期。`);
}
