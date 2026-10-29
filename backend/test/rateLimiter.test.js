const { afterEach, mock, test } = require('node:test');
const assert = require('node:assert/strict');
const createRateLimiter = require('../src/middleware/rateLimiter');

afterEach(() => mock.restoreAll());

test('limita requisições por janela e permite continuar após expiração', () => {
  let now = 1000;
  mock.method(Date, 'now', () => now);
  const rateLimiter = createRateLimiter({ limit: 1, windowMs: 60000 });

  function makeRequest() {
    let error;
    const headers = {};
    rateLimiter(
      { ip: '192.0.2.1', socket: { remoteAddress: '192.0.2.1' } },
      { set(name, value) { headers[name] = value; } },
      (nextError) => { error = nextError; },
    );
    return { error, headers };
  }

  assert.strictEqual(makeRequest().error, undefined);
  const limitedRequest = makeRequest();
  assert.strictEqual(limitedRequest.error.status, 429);
  assert.strictEqual(limitedRequest.error.code, 'RATE_LIMITED');
  assert.strictEqual(limitedRequest.headers['Retry-After'], '60');

  now += 60000;
  assert.strictEqual(makeRequest().error, undefined);
});
