import { findDatasetMatchesCore, importDatasetFileCore, readDatasetReportCore } from './local-dataset-core';
import type { DatasetProgress } from './local-dataset-core';
import type { BirthInfo, ZiweiChart } from './ziwei/types';
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void };
let running = false;
const controller = new AbortController();
scope.onmessage = async event => {
  if (event.data.type === 'cancel') { controller.abort(); return; }
  if (event.data.type !== 'start' || running) return;
  running = true;
  const { operation, payload } = event.data;
  const progress = (value: DatasetProgress) => scope.postMessage({ type: 'progress', progress: value });
  try {
    let result;
    if (operation === 'import') result = await importDatasetFileCore(payload.file as File, controller.signal, progress);
    else if (operation === 'match') result = await findDatasetMatchesCore(payload.chart as ZiweiChart, payload.limit as number, controller.signal, progress);
    else if (operation === 'report') result = await readDatasetReportCore(payload.file as File, payload.birth as BirthInfo, controller.signal, progress);
    else throw new Error('未知数据集操作');
    scope.postMessage({ type: 'success', result });
  } catch (error) { scope.postMessage({ type: 'error', name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : '操作失败' }); }
};
