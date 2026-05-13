const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { loadEnv } = require('../config/env');
const userRepo = require('../services/userRepository');

const cfg = loadEnv();

/** Verifies Cognito ID tokens (JWT) against the pool JWKS */
const verifier = CognitoJwtVerifier.create({
  userPoolId: cfg.cognitoUserPoolId,
  tokenUse: 'id',
  clientId: cfg.cognitoClientId,
});

/**
 * Express middleware: validates Authorization Bearer JWT and loads the app user profile.
 */
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Missing bearer token' });
    }
    const payload = await verifier.verify(token);
    const profile = await userRepo.getById(payload.sub);
    if (!profile) {
      return res.status(403).json({ message: 'User profile not provisioned' });
    }
    req.auth = { tokenPayload: payload, profile };
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const r = req.auth?.profile?.role;
    if (!r || !roles.includes(r)) {
      return res.status(403).json({ message: 'Insufficient role' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRoles };
