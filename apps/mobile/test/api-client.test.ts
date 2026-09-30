import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createApi, resolveApiUrl } from '../src/lib/api-client';

const emptyPage = { data: [], meta: { page: 1, limit: 12, total: 0, pageCount: 0 } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const mockFetch = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as typeof fetch;

test('resolves development hosts, preserves base path and refuses missing production configuration', () => {
  assert.equal(resolveApiUrl(undefined, 'android', true), 'http://10.0.2.2:3000/api/v1');
  assert.equal(resolveApiUrl(undefined, 'ios', true), 'http://localhost:3000/api/v1');
  assert.equal(resolveApiUrl(' https://api.example.com/api/v1/ ', 'web', false), 'https://api.example.com/api/v1');
  for (const url of [undefined, 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com?key=x']) {
    assert.throws(() => resolveApiUrl(url, 'web', false), ApiError);
  }
});

test('encodes searches and pagination without changing the API endpoint', async () => {
  const api = createApi(() => 'https://api.example.com/api/v1', mockFetch(async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/v1/products');
    assert.equal(parsed.searchParams.get('search'), 'serum & bakım');
    assert.equal(parsed.searchParams.get('page'), '2');
    return response(emptyPage);
  }));
  assert.deepEqual(await api.products(' serum & bakım ', 2), emptyPage);
});

test('does not expose arbitrary server errors and preserves request IDs', async () => {
  const api = createApi(() => 'https://api.example.com', mockFetch(async () => new Response('database password=secret', {
    status: 500, headers: { 'x-request-id': 'request-123' },
  })));
  await assert.rejects(api.products('', 1), (error: ApiError) => {
    assert.equal(error.status, 500);
    assert.equal(error.requestId, 'request-123');
    assert.ok(!error.message.includes('secret'));
    return true;
  });
});

test('distinguishes unavailable content and rate limiting', async () => {
  for (const status of [404, 429]) {
    const api = createApi(() => 'https://api.example.com', mockFetch(async () => response({}, status)));
    await assert.rejects(api.product('id'), (error: ApiError) => error.status === status);
  }
});

test('rejects malformed data instead of treating it as an empty catalog', async () => {
  const api = createApi(() => 'https://api.example.com', mockFetch(async () => response({ data: [{ id: 'bad' }] })));
  await assert.rejects(api.products('', 1), /beklenmeyen bir yanıt/);
});

test('preserves absent ratings rather than displaying a fabricated zero', async () => {
  const api = createApi(() => 'https://api.example.com', mockFetch(async () => response({ count: 0, averageRating: null, distribution: null })));
  assert.equal((await api.statistics('variant')).averageRating, null);
});

test('cancels in-flight requests when a screen or variant changes', async () => {
  const controller = new AbortController();
  const api = createApi(() => 'https://api.example.com', mockFetch(async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const pending = api.products('', 1, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('times out stalled requests and permits a subsequent retry', async () => {
  let calls = 0;
  const api = createApi(() => 'https://api.example.com', mockFetch(async (_url, init) => {
    calls++;
    if (calls === 2) return response(emptyPage);
    return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }), 5);
  await assert.rejects(api.products('', 1), /zaman aşımına/);
  assert.deepEqual(await api.products('', 1), emptyPage);
});
