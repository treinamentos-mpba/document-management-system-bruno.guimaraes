const HttpError = require('../errors/httpError');
const { auth } = require('../config');
const { verifyToken } = require('../services/authService');

function requireUserId(req, res, next) {
  if (auth.enabled) {
    const authorization = req.get('Authorization') || '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    const authenticatedUserId = match && verifyToken(match[1]);

    if (!authenticatedUserId) {
      return next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Autentique-se para continuar.'));
    }

    req.userId = authenticatedUserId;
    return next();
  }

  const userId = req.get('X-User-Id')?.trim();

  if (!userId || userId.length > 128) {
    return next(new HttpError(401, 'USER_ID_REQUIRED', 'Informe um identificador de usuário válido.'));
  }

  req.userId = userId;
  return next();
}

module.exports = requireUserId;