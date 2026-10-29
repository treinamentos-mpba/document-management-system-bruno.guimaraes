const HttpError = require('../errors/httpError');
const authService = require('../services/authService');
const { auth } = require('../config');

function mode(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.json({ authRequired: auth.enabled });
}

async function login(req, res, next) {
  if (!auth.enabled) {
    return next(new HttpError(404, 'NOT_FOUND', 'Endpoint não encontrado.'));
  }

  try {
    const session = await authService.login(req.body?.userId, req.body?.password);
    if (!session) {
      return next(new HttpError(401, 'INVALID_CREDENTIALS', 'Usuário ou senha inválidos.'));
    }

    res.set('Cache-Control', 'no-store');
    return res.json(session);
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, mode };
