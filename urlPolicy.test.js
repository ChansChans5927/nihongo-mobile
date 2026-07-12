const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyNavigationUrl,
  isPrivateDevHost,
  isTrustedAppUrl,
} = require('./urlPolicy');

test('allows the exact production origin and its paths', () => {
  assert.equal(isTrustedAppUrl('https://nihongo-gakushu.onrender.com', false), true);
  assert.equal(isTrustedAppUrl('https://nihongo-gakushu.onrender.com/study?level=N5', false), true);
});

test('rejects prefix and credential-based origin bypasses', () => {
  assert.equal(isTrustedAppUrl('https://nihongo-gakushu.onrender.com.evil.example', false), false);
  assert.equal(isTrustedAppUrl('https://nihongo-gakushu.onrender.com@evil.example', false), false);
  assert.equal(isTrustedAppUrl('http://nihongo-gakushu.onrender.com', false), false);
});

test('allows only private local development hosts in development builds', () => {
  assert.equal(isPrivateDevHost('10.0.0.5'), true);
  assert.equal(isPrivateDevHost('172.16.0.5'), true);
  assert.equal(isPrivateDevHost('172.31.255.255'), true);
  assert.equal(isPrivateDevHost('172.32.0.5'), false);
  assert.equal(isPrivateDevHost('192.168.0.5'), true);
  assert.equal(isTrustedAppUrl('http://192.168.0.5:3000', true), true);
  assert.equal(isTrustedAppUrl('http://192.168.0.5:3000', false), false);
  assert.equal(isTrustedAppUrl('http://10.evil.example', true), false);
});

test('opens safe external schemes outside the WebView', () => {
  assert.equal(classifyNavigationUrl('https://example.com', false), 'external');
  assert.equal(classifyNavigationUrl('mailto:hello@example.com', false), 'external');
  assert.equal(classifyNavigationUrl('tel:+821012345678', false), 'external');
});

test('blocks executable and local-file schemes', () => {
  assert.equal(classifyNavigationUrl('javascript:alert(1)', false), 'blocked');
  assert.equal(classifyNavigationUrl('data:text/html,<script>alert(1)</script>', false), 'blocked');
  assert.equal(classifyNavigationUrl('file:///etc/passwd', false), 'blocked');
  assert.equal(classifyNavigationUrl('intent://malicious', false), 'blocked');
});
