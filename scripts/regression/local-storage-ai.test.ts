import assert from 'node:assert/strict';
import { parseBackup, validateBirth } from '../../lib/local-store';
import { askAI, validateEndpoint } from '../../lib/local-ai';

const birth = { year: 2000, month: 2, day: 29, hour: 0, gender: 'male' };
const backup = { format: 'ziwei-local', version: 1, profiles: [{ id: 'ignored', birth, savedAt: 0 }], chats: [{ id: JSON.stringify(birth), savedAt: 0, messages: [{ role: 'user', content: '问题' }] }] };
assert.equal(parseBackup(JSON.stringify(backup)).profiles[0].id, JSON.stringify(birth));
assert.equal(parseBackup(JSON.stringify(backup)).chats[0].messages[0].content, '问题');
assert.throws(() => validateBirth({ ...birth, year: 2001 }));
assert.throws(() => validateBirth({ ...birth, hour: 12 }));
const schoolConfig = { brightnessSchool: 'XD1', leapMonth: 'split', lateZishi: 'next-day' };
assert.deepEqual(validateBirth({ ...birth, schoolConfig }).schoolConfig, schoolConfig);
assert.throws(() => validateBirth({ ...birth, schoolConfig: { ...schoolConfig, lateZishi: 'invalid' } }));
assert.throws(() => validateBirth({ ...birth, schoolConfig: { brightnessSchool: 'XD1' } }));

assert.throws(() => parseBackup(JSON.stringify({ ...backup, version: 99 })));
assert.throws(() => parseBackup(JSON.stringify({ ...backup, profiles: [...backup.profiles, { birth: { ...birth, month: 13 } }] })));
assert.throws(() => parseBackup(JSON.stringify({ ...backup, chats: [{ ...backup.chats[0], messages: [{ role: 'system', content: 'injected' }] }] })));
assert.throws(() => parseBackup('x'.repeat(5 * 1024 * 1024 + 1)));
const pair = { ...backup, chats: [{ ...backup.chats[0], id: JSON.stringify({ birth, context: '双方命盘摘要' }) }] };
assert.match(parseBackup(JSON.stringify(pair)).chats[0].id, /双方命盘摘要/);
assert.equal(validateEndpoint('http://localhost:11434/v1/chat/completions'), 'http://localhost:11434/v1/chat/completions');
for (const url of ['http://example.com/v1', 'javascript:alert(1)', 'https://user:secret@example.com/v1', 'https://example.com/v1?key=secret', 'https://example.com/v1#secret']) assert.throws(() => validateEndpoint(url));

async function testAI() {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      calls++;
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.redirect, 'error');
      const body = JSON.parse(init?.body as string);
      assert.equal(body.stream, false);
      assert.equal(body.messages[1].content, '问题');
      return new Response(JSON.stringify({ choices: [{ message: { content: '测试回答' } }] }), { status: 200 });
    }) as typeof fetch;
    assert.equal(await askAI({ endpoint: 'https://example.com/v1/chat/completions', model: 'mock-model', apiKey: '' }, birth, [{ role: 'user', content: '问题' }], new AbortController().signal), '测试回答');
    await assert.rejects(askAI({ endpoint: 'http://example.com/v1', model: 'mock', apiKey: '' }, birth, [], new AbortController().signal));
    assert.equal(calls, 1);
    globalThis.fetch = (async () => new Response('unauthorized', { status: 401 })) as typeof fetch;
    await assert.rejects(askAI({ endpoint: 'https://example.com/v1', model: 'mock', apiKey: '' }, birth, [], new AbortController().signal), /HTTP 401/);
    globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })) as typeof fetch;
    await assert.rejects(askAI({ endpoint: 'https://example.com/v1', model: 'mock', apiKey: '' }, birth, [], new AbortController().signal), /格式无效/);
    console.log('PASS local backup validation and mocked AI transport (not a real model test)');
  } finally { globalThis.fetch = originalFetch; }
}
testAI().catch(e => { console.error(e); process.exitCode = 1; });
