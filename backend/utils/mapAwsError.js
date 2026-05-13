/**
 * Maps AWS SDK v3 client errors to HTTP responses so callers see the real Cognito/Dynamo message
 * instead of a generic 500.
 */
function mapAwsClientError(err) {
  if (!err || typeof err.message !== 'string') return null;
  const meta = err.$metadata;
  const code = err.name || err.__type;
  if (!meta && !code) return null;

  const http = meta?.httpStatusCode;
  const status =
    typeof http === 'number' && http >= 400 && http < 600 ? (http >= 500 ? 502 : http) : 400;

  return {
    status,
    message: err.message,
    code: code || 'AWSError',
  };
}

module.exports = { mapAwsClientError };
