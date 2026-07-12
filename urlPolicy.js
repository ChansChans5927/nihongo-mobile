const PRODUCTION_ORIGIN = 'https://nihongo-gakushu.onrender.com';

function isValidIpv4Part(value) {
  return /^\d{1,3}$/.test(value) && Number(value) >= 0 && Number(value) <= 255;
}

function isPrivateDevHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  const parts = hostname.split('.');
  if (parts.length !== 4 || !parts.every(isValidIpv4Part)) return false;

  const [first, second] = parts.map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isTrustedAppUrl(rawUrl, isDevelopment) {
  try {
    const url = new URL(rawUrl);
    if (url.origin === PRODUCTION_ORIGIN) return true;

    return (
      isDevelopment &&
      url.protocol === 'http:' &&
      isPrivateDevHost(url.hostname)
    );
  } catch {
    return false;
  }
}

function classifyNavigationUrl(rawUrl, isDevelopment) {
  if (isTrustedAppUrl(rawUrl, isDevelopment)) return 'internal';
  if (rawUrl === 'about:blank' || rawUrl.startsWith('chrome-error://')) return 'internal';

  try {
    const url = new URL(rawUrl);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
      ? 'external'
      : 'blocked';
  } catch {
    return 'blocked';
  }
}

module.exports = {
  PRODUCTION_ORIGIN,
  classifyNavigationUrl,
  isPrivateDevHost,
  isTrustedAppUrl,
};
