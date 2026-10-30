import type { BirthInfo, ZiweiChart } from './ziwei/types';
import { deleteDatasetYearCore, listDatasetYearsCore } from './local-dataset-core';
import type { DatasetMatch, DatasetMatchScope, DatasetProgressCallback, DatasetReport, DatasetYear } from './local-dataset-core';
export { DATASET_SOURCE, MAX_DATASET_FILE, MAX_DATASET_LINE } from './local-dataset-core';
export type { DatasetProgress, DatasetYear, DatasetMatch, DatasetMatchScope, DatasetReport } from './local-dataset-core';

function runWorker<T>(operation: 'import' | 'match' | 'report', payload: Record<string, unknown>, signal?: AbortSignal, onProgress?: DatasetProgressCallback): Promise<T> {
  if (signal?.aborted) return Promise.reject(new DOMException('操作已取消', 'AbortError'));
  if (typeof Worker === 'undefined') return Promise.reject(new Error('当前浏览器不支持 Web Worker，请使用支持 Worker 的现代浏览器；不会在主线程加载整份数据。'));
  return new Promise((resolve, reject) => {
    const worker = new Worker('/local-dataset.worker.js', { type: 'module' });
    const cleanup = () => { signal?.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => worker.postMessage({ type: 'cancel' });
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => {
      const message = event.data;
      if (message.type === 'progress') { onProgress?.(message.progress); return; }
      cleanup();
      if (message.type === 'success') resolve(message.result as T);
      else reject(message.name === 'AbortError' ? new DOMException(message.message, 'AbortError') : new Error(message.message ?? '数据集操作失败'));
    };
    worker.onerror = event => { cleanup(); reject(new Error(`数据集 Worker 运行失败：${event.message || '请检查浏览器设置'}；旧索引仍可使用。`)); };
    worker.onmessageerror = () => { cleanup(); reject(new Error('数据集 Worker 消息无法解析')); };
    worker.postMessage({ type: 'start', operation, payload });
    if (signal?.aborted) abort();
  });
}
export function importDatasetFile(file: File, signal?: AbortSignal, onProgress?: DatasetProgressCallback): Promise<DatasetYear[]> { return runWorker('import', { file }, signal, onProgress); }
export const listDatasetYears = listDatasetYearsCore;
export const deleteDatasetYear = deleteDatasetYearCore;
export function findDatasetMatches(chart: ZiweiChart, limit = 20, signal?: AbortSignal, onProgress?: DatasetProgressCallback, scope: DatasetMatchScope = 'all'): Promise<DatasetMatch[]> { return runWorker('match', { chart, limit, scope }, signal, onProgress); }
export function readDatasetReport(file: File, birth: BirthInfo, signal?: AbortSignal, onProgress?: DatasetProgressCallback): Promise<DatasetReport> { return runWorker('report', { file, birth }, signal, onProgress); }
