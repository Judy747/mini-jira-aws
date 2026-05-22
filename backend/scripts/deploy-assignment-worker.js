/**
 * Package and deploy mini-jira-assignment-worker Lambda code.
 *
 * Usage (from backend/):
 *   node scripts/deploy-assignment-worker.js
 *
 * Requires AWS credentials (backend/.env) and @aws-sdk/client-lambda.
 */
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { LambdaClient, UpdateFunctionCodeCommand, GetFunctionConfigurationCommand } =
  require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || 'us-east-1';
const FUNCTION_NAME = process.env.ASSIGNMENT_WORKER_NAME || 'mini-jira-assignment-worker';
const ROOT = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT, 'lambda', 'assignmentWorker.zip');

function packageWorker() {
  const ps1 = path.join(__dirname, 'package-assignment-worker.ps1');
  console.log('[deploy-assignment-worker] packaging…');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error(`Zip not found: ${ZIP_PATH}`);
  }
}

async function deploy() {
  const zipBytes = fs.readFileSync(ZIP_PATH);
  const lambda = new LambdaClient({ region: REGION });

  let before;
  try {
    before = await lambda.send(
      new GetFunctionConfigurationCommand({ FunctionName: FUNCTION_NAME })
    );
    console.log(
      `[deploy-assignment-worker] current: ${before.FunctionName} handler=${before.Handler} modified=${before.LastModified}`
    );
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') {
      throw new Error(
        `Lambda "${FUNCTION_NAME}" not found in ${REGION}. Deploy infra/assignment-pipeline.yaml first.`
      );
    }
    throw e;
  }

  const out = await lambda.send(
    new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBytes,
    })
  );

  console.log('[deploy-assignment-worker] update submitted');
  console.log(`  Function:  ${out.FunctionName}`);
  console.log(`  Version:   ${out.Version}`);
  console.log(`  CodeSize:  ${out.CodeSize} bytes`);
  console.log(`  Modified:  ${out.LastModified}`);
  console.log('[deploy-assignment-worker] Done. Assign a task to smoke-test CloudWatch logs.');
}

packageWorker();
deploy().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
