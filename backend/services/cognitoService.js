const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { loadEnv } = require('../config/env');
const { AppError } = require('../utils/errors');

const cfg = loadEnv();
const client = new CognitoIdentityProviderClient({ region: cfg.awsRegion });

function secretHash(username) {
  if (!cfg.cognitoClientSecret) return undefined;
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', cfg.cognitoClientSecret);
  hmac.update(username + cfg.cognitoClientId);
  return hmac.digest('base64');
}

/**
 * Maps Cognito errors for confirm / resend flows into HTTP-friendly AppErrors.
 */
function mapCognitoUserLifecycleError(err) {
  const name = err.name || err.__type;
  const msg = (err.message || '').trim();

  switch (name) {
    case 'CodeMismatchException':
      return new AppError('Invalid verification code. Check the code from your email and try again.', 400);
    case 'ExpiredCodeException':
      return new AppError('That verification code has expired. Use “Resend code” to get a new one.', 400);
    case 'UserNotFoundException':
      return new AppError('No pending registration found for this email.', 404);
    case 'InvalidParameterException':
      return new AppError(msg || 'Invalid email or code format.', 400);
    case 'NotAuthorizedException':
      if (/already\s+confirmed|CONFIRMED|cannot\s+be\s+confirmed/i.test(msg)) {
        return new AppError('This account is already confirmed. You can sign in.', 409);
      }
      return new AppError(msg || 'Unable to complete this step.', 400);
    case 'AliasExistsException':
      return new AppError('An account with this email already exists.', 409);
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return new AppError('Too many attempts. Please wait a few minutes and try again.', 429);
    default:
      return null;
  }
}

function rethrowCognito(err) {
  const mapped = mapCognitoUserLifecycleError(err);
  if (mapped) throw mapped;
  throw err;
}

/**
 * Register a new user in the Cognito User Pool (and optionally auto-confirm in dev).
 */
async function signUp({ email, password, name }) {
  const params = {
    ClientId: cfg.cognitoClientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: name || email },
    ],
  };
  const sh = secretHash(email);
  if (sh) params.SecretHash = sh;
  const out = await client.send(new SignUpCommand(params));
  if (process.env.COGNITO_AUTO_CONFIRM === 'true') {
    try {
      await client.send(
        new AdminConfirmSignUpCommand({
          UserPoolId: cfg.cognitoUserPoolId,
          Username: email,
        })
      );
    } catch {
      // Pool may not allow admin APIs from this principal — ignore
    }
  }
  return out;
}

/**
 * Confirms a user after they enter the email verification code from Cognito.
 */
async function confirmSignUp({ email, code }) {
  const params = {
    ClientId: cfg.cognitoClientId,
    Username: email,
    ConfirmationCode: String(code).trim(),
  };
  const sh = secretHash(email);
  if (sh) params.SecretHash = sh;
  try {
    await client.send(new ConfirmSignUpCommand(params));
  } catch (err) {
    rethrowCognito(err);
  }
}

/**
 * Resends the email verification code for an unconfirmed user.
 */
async function resendConfirmationCode({ email }) {
  const params = {
    ClientId: cfg.cognitoClientId,
    Username: email,
  };
  const sh = secretHash(email);
  if (sh) params.SecretHash = sh;
  try {
    await client.send(new ResendConfirmationCodeCommand(params));
  } catch (err) {
    rethrowCognito(err);
  }
}

/**
 * USER_PASSWORD_AUTH — ensure the app client allows this flow in Cognito.
 */
async function initiateAuth(email, password) {
  const authParams = { USERNAME: email, PASSWORD: password };
  const sh = secretHash(email);
  if (sh) authParams.SECRET_HASH = sh;
  const out = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cfg.cognitoClientId,
      AuthParameters: authParams,
    })
  );
  if (out.ChallengeName) {
    throw new AppError(
      `Cognito challenge required: ${out.ChallengeName}. Complete in console or adjust pool.`,
      400
    );
  }
  if (!out.AuthenticationResult) {
    throw new AppError('Authentication failed', 401);
  }
  return out.AuthenticationResult;
}

async function adminCreateUser({ email, temporaryPassword, name }) {
  const params = {
    UserPoolId: cfg.cognitoUserPoolId,
    Username: email,
    TemporaryPassword: temporaryPassword,
    MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: name || email },
    ],
  };
  const out = await client.send(new AdminCreateUserCommand(params));
  let sub = out.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) {
    const got = await client.send(
      new AdminGetUserCommand({ UserPoolId: cfg.cognitoUserPoolId, Username: email })
    );
    sub = got.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
  }
  if (!sub) {
    throw new Error('Could not resolve Cognito sub for new user');
  }
  return sub;
}

module.exports = {
  signUp,
  confirmSignUp,
  resendConfirmationCode,
  initiateAuth,
  adminCreateUser,
};
