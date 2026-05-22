/**
 * Push EMAIL_* (and optional overrides) from backend/.env onto the assignment worker Lambda.
 *
 * Required in backend/.env:
 *   EMAIL_USER=you@gmail.com
 *   EMAIL_PASS=16-char-gmail-app-password
 *
 * Usage: node scripts/update-assignment-worker-env.js
 */
require('dotenv').config();
const {
  LambdaClient,
  GetFunctionConfigurationCommand,
  UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.ASSIGNMENT_WORKER_NAME || 'mini-jira-assignment-worker';

const EMAIL_USER = process.env.EMAIL_USER?.trim();
const EMAIL_PASS = process.env.EMAIL_PASS?.trim();

async function main() {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error(
      'Add to backend/.env:\n' +
        '  EMAIL_USER=yourname@gmail.com\n' +
        '  EMAIL_PASS=your-gmail-app-password\n' +
        'Then re-run: node scripts/update-assignment-worker-env.js'
    );
    process.exit(1);
  }
  const lambda = new LambdaClient({ region: REGION });
  const current = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: FUNCTION_NAME })
  );
  const vars = { ...(current.Environment?.Variables || {}) };
  vars.EMAIL_USER = EMAIL_USER;
  vars.EMAIL_PASS = EMAIL_PASS;
  if (process.env.EMAIL_SMTP_HOST) {
    vars.EMAIL_SMTP_HOST = process.env.EMAIL_SMTP_HOST;
  } else {
    delete vars.EMAIL_SMTP_HOST;
  }
  if (process.env.EMAIL_SMTP_PORT) {
    vars.EMAIL_SMTP_PORT = process.env.EMAIL_SMTP_PORT;
  }

  await lambda.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Environment: { Variables: vars },
    })
  );

  const masked = EMAIL_USER.replace(/(.{2}).*(@.*)/, '$1***$2');
  console.log(`[update-assignment-worker-env] Updated ${FUNCTION_NAME}`);
  console.log(`  EMAIL_USER=${masked}`);
  console.log('  EMAIL_PASS=********');
  console.log('  SMTP:', vars.EMAIL_SMTP_HOST || 'smtp.gmail.com (auto for @gmail.com)');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
