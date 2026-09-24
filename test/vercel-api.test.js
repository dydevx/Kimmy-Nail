'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { allowBookingCors } = require('../lib/vercel-api');

function responseMock() {
  const headers = new Map();
  return {
    headers,
    ended: false,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end() { this.ended = true; }
  };
}

test('allows the Webcake production origin to call booking APIs', () => {
  const response = responseMock();
  const handled = allowBookingCors(
    { method: 'GET', headers: { origin: 'https://www.kimmynail.de' } },
    response,
    ['GET', 'OPTIONS']
  );

  assert.equal(handled, false);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://www.kimmynail.de');
  assert.equal(response.headers.get('vary'), 'Origin');
});

test('handles booking API preflight without querying the database', () => {
  const response = responseMock();
  const handled = allowBookingCors(
    { method: 'OPTIONS', headers: { origin: 'https://www.kimmynail.de' } },
    response,
    ['POST', 'OPTIONS']
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('allows local static previews to call the production booking API', () => {
  for (const origin of ['http://localhost:5500', 'http://127.0.0.1:8080']) {
    const response = responseMock();
    allowBookingCors(
      { method: 'GET', headers: { origin } },
      response,
      ['GET', 'OPTIONS']
    );

    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
});

test('allows the Webcake preview to call booking APIs', () => {
  const response = responseMock();
  allowBookingCors(
    { method: 'GET', headers: { origin: 'https://preview.webcake.io' } },
    response,
    ['GET', 'OPTIONS']
  );

  assert.equal(response.headers.get('access-control-allow-origin'), 'https://preview.webcake.io');
});

test('does not grant cross-origin access to unknown websites', () => {
  const response = responseMock();
  allowBookingCors(
    { method: 'GET', headers: { origin: 'https://example.com' } },
    response,
    ['GET', 'OPTIONS']
  );

  assert.equal(response.headers.has('access-control-allow-origin'), false);
});
