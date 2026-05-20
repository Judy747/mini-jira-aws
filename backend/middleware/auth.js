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
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  let payload;
  try {
    payload = await verifier.verify(token);
  } catch (e) {
    console.error('[auth] JWT verify failed:', e.message);
    const dev = process.env.NODE_ENV !== 'production';
    return res.status(401).json({
      message: dev
        ? `Invalid or expired token (${e.message}). Check COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID in backend/.env match your Cognito app client.`
        : 'Invalid or expired token',
    });
  }

  try {
    const profile = await userRepo.getById(payload.sub);
    if (!profile) {
      return res.status(403).json({
        message:
          'User profile not provisioned. In DynamoDB mini-jira-users, add a row where userId equals this Cognito User sub.',
        cognitoSub: payload.sub,
      });
    }
    req.auth = { tokenPayload: payload, profile };
    next();
  } catch (e) {
    console.error('[auth] DynamoDB profile lookup failed:', e);
    const dev = process.env.NODE_ENV !== 'production';
    const detail = e?.name && e?.message ? `${e.name}: ${e.message}` : String(e);
    return res.status(503).json({
      message: dev
        ? `Could not load user profile from database (${detail}). Ensure AWS credentials can access table ${cfg.dynamo.users} in ${cfg.awsRegion}.`
        : 'Could not load user profile from database',
    });
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
