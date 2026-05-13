const cognito = require('../services/cognitoService');
const userRepo = require('../services/userRepository');
const { AppError } = require('../utils/errors');

async function register(req, res, next) {
  try {
    const { email, password, name, teamId, role } = req.body || {};
    if (!email || !password) {
      throw new AppError('email and password are required');
    }
    let finalRole = 'EMPLOYEE';
    if (role && role !== 'EMPLOYEE') {
      throw new AppError('Public registration is employee-only', 403);
    }
    if (!teamId) {
      throw new AppError('teamId is required for employee registration');
    }
    const out = await cognito.signUp({ email, password, name: name || email });
    const userId = out.UserSub;
    await userRepo.createUser({
      userId,
      email,
      name: name || email,
      role: finalRole,
      teamId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({
      message: 'Registered. Confirm email if required by your pool.',
      userId,
    });
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new AppError('email and password are required');
    }
    const auth = await cognito.initiateAuth(email, password);
    res.json({
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn,
    });
  } catch (e) {
    next(e);
  }
}

async function confirm(req, res, next) {
  try {
    const { email, code } = req.body || {};
    if (!email || !String(email).trim()) {
      throw new AppError('email is required');
    }
    if (!code || !String(code).trim()) {
      throw new AppError('verification code is required');
    }
    await cognito.confirmSignUp({ email: String(email).trim(), code: String(code).trim() });
    res.json({ message: 'Account confirmed. You can sign in.' });
  } catch (e) {
    next(e);
  }
}

async function resendCode(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).trim()) {
      throw new AppError('email is required');
    }
    await cognito.resendConfirmationCode({ email: String(email).trim() });
    res.json({ message: 'A new verification code has been sent to your email.' });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login, confirm, resendCode };
