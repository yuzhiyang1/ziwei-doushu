import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { generateLocalChart } from '../../lib/local-chart';
import { chartSignature, DATASET_DB, DATASET_DIMENSIONS, datasetLines, deleteDatasetYearCore, findDatasetMatchesCore, importDatasetFileCore, listDatasetYearsCore, MAX_DATASET_FILE, MAX_DATASET_LINE, parseDatasetRow, readDatasetReportCore, signatureScore, type DatasetFile } from '../../lib/local-dataset-core';

const dimensions = Object.fromEntries(DATASET_DIMENSIONS.map((name, i) => [name, `合成测试报告${i}，并非官方报告。`]));
function row(hour = 0, year = 1990) { return { k: `${year}-01-01-${hour}-male`, y: year, m: 1, d: 1, h: hour, g: 'male', ms: '紫微', t: {}, c: dimensions }; }
function fixture(text: string, chunkSize = 37): DatasetFile {
  const bytes = new TextEncoder().encode(text); let offset = 0;
  return { name: 'synthetic.jsonl', size: bytes.length, stream: () => new ReadableStream({ pull(controller) { if (offset >= bytes.length) { controller.close(); return; } controller.enqueue(bytes.slice(offset, offset + chunkSize)); offset += chunkSize; } }) };
}
function fixtureRows(rows: unknown[]) { return fixture(rows.map(r => JSON.stringify(r)).join('\r\n')); }
async function recordCount(): Promise<number> {
  return new Promise((resolve, reject) => { const req = indexedDB.open(DATASET_DB, 2); req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('records', 'readonly'), count = tx.objectStore('records').count(); tx.oncomplete = () => { db.close(); resolve(count.result); }; }; });
}
async function main() {
  assert.equal(parseDatasetRow(JSON.stringify(row())).birth.hour, 0);
  assert.throws(() => parseDatasetRow(JSON.stringify({ ...row(), k: 'wrong' })));
  assert.throws(() => parseDatasetRow(JSON.stringify({ ...row(), c: { only: 'one' } })));
  assert.throws(() => parseDatasetRow(JSON.stringify({ ...row(), y: 1949 })));
  assert.throws(() => parseDatasetRow(JSON.stringify({ ...row(), d: 30, m: 2 })));
  assert.equal(signatureScore(['a', 'b'], ['b', 'c']), 33.33);
  assert.equal(signatureScore([], []), 0);
  const chart = generateLocalChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
  assert.equal(chartSignature(chart).length, 14);
  let years = await importDatasetFileCore(fixtureRows([row(), row(1)]));
  assert.equal(years[0].count, 2);
  let matches = await findDatasetMatchesCore(chart);
  assert.equal(matches[0].key, row().k); assert.equal(matches[0].score, 100);
  const originalVersion = years[0].version;
  await assert.rejects(importDatasetFileCore(fixtureRows([row(), row()])));
  assert.equal((await listDatasetYearsCore())[0].version, originalVersion, 'duplicate errors retain old active index');
  await assert.rejects(importDatasetFileCore(fixtureRows([row(), row(1, 1991)])));
  assert.equal((await listDatasetYearsCore())[0].version, originalVersion, 'mixed-year errors retain active index');
  await assert.rejects(importDatasetFileCore(fixture(JSON.stringify(row()) + '\n{bad-json')));
  assert.equal((await listDatasetYearsCore())[0].version, originalVersion);
  const abort = new AbortController();
  await assert.rejects(importDatasetFileCore(fixtureRows([row(), row(1)]), abort.signal, p => { if (p.phase === 'indexing' && p.rows === 1) abort.abort(); }), { name: 'AbortError' });
  assert.equal((await listDatasetYearsCore())[0].version, originalVersion, 'cancellation retains old index');
  const manyRows = Array.from({ length: 30 }, (_, index) => { const r = row(index % 12); const day = Math.floor(index / 12) + 1; return { ...r, d: day, k: `1990-01-${String(day).padStart(2, '0')}-${r.h}-male` }; });
  const lateAbort = new AbortController();
  await assert.rejects(importDatasetFileCore(fixtureRows(manyRows), lateAbort.signal, p => { if (p.phase === 'indexing' && p.rows === 25) lateAbort.abort(); }), { name: 'AbortError' });
  assert.equal(await recordCount(), 2, 'cancel after a flushed staging batch must remove staged records');
  years = await importDatasetFileCore(fixtureRows([row()]));
  assert.equal(years.length, 1); assert.equal(years[0].count, 1); assert.notEqual(years[0].version, originalVersion);
  assert.equal((await findDatasetMatchesCore(chart)).length, 1, 'replacing year removes old active rows');
  const report = await readDatasetReportCore(fixtureRows([row(), row(1)]), chart.birthInfo);
  assert.equal(Object.keys(report.dimensions).length, 13); assert.match(report.content, /合成测试报告12/);
  await assert.rejects(readDatasetReportCore(fixtureRows([row(1)]), chart.birthInfo), /没有/);
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(readDatasetReportCore(fixtureRows([row()]), chart.birthInfo, alreadyAborted.signal), { name: 'AbortError' });
  await assert.rejects(findDatasetMatchesCore(chart, 20, alreadyAborted.signal), { name: 'AbortError' });
  await assert.rejects(importDatasetFileCore(fixture(' '.repeat(MAX_DATASET_LINE + 1), 65536)), /超过 2 MB/);
  const oversized = fixtureRows([row()]); oversized.size = MAX_DATASET_FILE + 1;
  await assert.rejects(importDatasetFileCore(oversized), /2 GB/);
  const lines = []; for await (const line of datasetLines(fixture(JSON.stringify(row()) + '\n\n' + JSON.stringify(row(1)), 1))) lines.push(line);
  assert.equal(lines.length, 2, 'UTF-8 split boundaries and blank lines work');
  await deleteDatasetYearCore(1990); assert.equal((await listDatasetYearsCore()).length, 0); assert.equal((await findDatasetMatchesCore(chart)).length, 0);
  console.log('PASS dataset streaming UTF-8, validation, indexing, exact report, cancellation, replacement atomicity, limits and deletion (synthetic + fake IndexedDB)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
