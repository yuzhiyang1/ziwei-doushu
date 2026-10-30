const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('public/local-dataset.worker.js', 'utf8');
const dimensions = Object.fromEntries(['overview', 'personality', 'love', 'career', 'wealth', 'health', 'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents'].map(key => [key, `synthetic ${key}`]));
const row = { k: '1990-01-01-0-male', y: 1990, m: 1, d: 1, h: 0, g: 'male', ms: null, c: dimensions, t: {} };
async function run(operation, payload) {
  const messages = [];
  const scope = vm.createContext({ indexedDB, IDBKeyRange, crypto: webcrypto, TextDecoder, TextEncoder, setTimeout, clearTimeout, AbortController, DOMException, console, postMessage: message => messages.push(message) });
  vm.runInContext(source, scope, { filename: 'local-dataset.worker.js' });
  assert.equal(typeof scope.onmessage, 'function', 'bundle must install a worker message handler');
  await scope.onmessage({ data: { type: 'start', operation, payload } });
  const result = messages.at(-1);
  assert.equal(result.type, 'success', JSON.stringify(result));
  return result.result;
}
(async () => {
  const file = new File([JSON.stringify(row)], 'synthetic-worker.jsonl');
  const years = await run('import', { file });
  assert.equal(years[0].count, 1);
  const report = await run('report', { file, birth: { year: 1990, month: 1, day: 1, hour: 0, gender: 'male' } });
  assert.equal(report.key, row.k); assert.equal(Object.keys(report.dimensions).length, 13);
  console.log('PASS built browser-worker JavaScript executed in isolated worker-like VM: import and exact report (not real browser E2E)');
})().catch(error => { console.error(error); process.exitCode = 1; });
