const HttpError = require('../errors/httpError');

function createRateLimiter({ limit, windowMs, code = 'RATE_LIMITED' }) {
  const requests = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = requests.get(key);
    const bucket = current && now - current.startedAt < windowMs
      ? current
      : { startedAt: now, count: 0 };

    bucket.count += 1;
    requests.delete(key);
    requests.set(key, bucket);

    if (requests.size > 10000) {
      const entriesToRemove = requests.size - 8000;
      for (const expiredKey of requests.keys()) {
        requests.delete(expiredKey);
        if (requests.size <= 10000 - entriesToRemove) {
          break;
        }
      }
    }

    if (bucket.count > limit) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return next(new HttpError(429, code, 'Muitas requisições. Tente novamente em instantes.'));
    }

    return next();
  };
}

module.exports = createRateLimiter;
