const HttpError = require('../errors/httpError');

function requireUserId(req, res, next) {
  const userId = req.get('X-User-Id')?.trim();

  if (!userId) {
    return next(new HttpError(401, 'USER_ID_REQUIRED', 'O cabeçalho X-User-Id é obrigatório.'));
  }

  req.userId = userId;
  return next();
}

module.exports = requireUserId;