/**
 * Deploy the backend across the Mini-Jira EC2 Auto Scaling Group.
 *
 * For each EC2 instance tagged with the mini-jira ASG name, this script
 * runs (in parallel) via AWS Systems Manager Run Command:
 *
 *   sudo -u miniapp git fetch origin
 *   sudo -u miniapp git reset --hard origin/main
 *   sudo -u miniapp npm --prefix backend install --omit=dev
 *   sudo systemctl restart mini-jira
 *
 * Then it polls each command invocation until they all complete, prints
 * exit codes and stderr/stdout, and exits non-zero if any instance failed.
 *
 * Usage (from backend/ folder):
 *   node scripts/deploy-backend.js              # deploys origin/main
 *   node scripts/deploy-backend.js feature-x    # deploys origin/feature-x
 *
 * Or from anywhere via the wrapper:
 *   .\backend\deploy-backend.ps1
 *
 * Required IAM permissions on the user running this (in addition to existing):
 *   - ec2:DescribeInstances
 *   - ssm:SendCommand
 *   - ssm:GetCommandInvocation
 *
 * The EC2 instance role already has SSM perms (set up in user-data infra).
 */
require('dotenv').config();
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const {
  SSMClient,
  SendCommandCommand,
  GetCommandInvocationCommand,
} = require('@aws-sdk/client-ssm');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ASG_NAME = process.env.MINI_JIRA_ASG_NAME || 'mini-jira-asg';
const BRANCH = (process.argv[2] || 'main').trim();

const ec2 = new EC2Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

async function listAsgInstanceIds() {
  const r = await ec2.send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: 'tag:aws:autoscaling:groupName', Values: [ASG_NAME] },
        { Name: 'instance-state-name', Values: ['running'] },
      ],
    })
  );
  const ids = [];
  for (const res of r.Reservations || []) {
    for (const inst of res.Instances || []) {
      ids.push(inst.InstanceId);
    }
  }
  return ids;
}

function buildDeployScript(branch) {
  return [
    'set -euo pipefail',
    'APP_DIR=/opt/mini-jira',
    'APP_USER=miniapp',
    `BRANCH=${JSON.stringify(branch)}`,
    'echo "[deploy] host=$(hostname) branch=$BRANCH at $(date -u)"',
    'sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin --prune',
    'sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"',
    // Use `npm install` (not `npm ci`) so we keep working when teammates merge
    // PRs that touch backend/package.json without regenerating package-lock.json.
    'sudo -u "$APP_USER" --preserve-env=HOME bash -lc "cd \'$APP_DIR/backend\' && npm install --omit=dev --no-fund --no-audit"',
    'systemctl restart mini-jira.service',
    'sleep 2',
    'systemctl is-active mini-jira.service',
    'echo "[deploy] done at $(date -u)"',
  ].join('\n');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForInvocation(commandId, instanceId) {
  for (let i = 0; i < 120; i += 1) {
    // up to ~6 min
    try {
      const r = await ssm.send(
        new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: instanceId })
      );
      if (
        r.Status === 'Success' ||
        r.Status === 'Failed' ||
        r.Status === 'Cancelled' ||
        r.Status === 'TimedOut'
      ) {
        return r;
      }
    } catch (e) {
      // SSM may return InvocationDoesNotExist briefly right after SendCommand
      if (e.name !== 'InvocationDoesNotExist') throw e;
    }
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for SSM invocation on ${instanceId}`);
}

async function main() {
  console.log(`[deploy-backend] region=${REGION} asg=${ASG_NAME} branch=${BRANCH}`);
  const instances = await listAsgInstanceIds();
  if (instances.length === 0) {
    throw new Error(
      `No running EC2 instances found with tag aws:autoscaling:groupName=${ASG_NAME}. ` +
        `Set MINI_JIRA_ASG_NAME env var if your ASG has a different name.`
    );
  }
  console.log(`[deploy-backend] targeting ${instances.length} instance(s): ${instances.join(', ')}`);

  const cmd = await ssm.send(
    new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      InstanceIds: instances,
      Comment: `mini-jira backend deploy ${BRANCH}`,
      TimeoutSeconds: 600,
      Parameters: {
        commands: [buildDeployScript(BRANCH)],
        executionTimeout: ['600'],
      },
    })
  );
  const commandId = cmd.Command.CommandId;
  console.log(`[deploy-backend] command ${commandId} dispatched; polling for completion...`);

  // Give SSM a moment to register the invocations before polling
  await sleep(2000);

  const results = await Promise.all(
    instances.map(async (id) => {
      const r = await waitForInvocation(commandId, id);
      return { id, r };
    })
  );

  let anyFailed = false;
  for (const { id, r } of results) {
    const ok = r.Status === 'Success' && r.ResponseCode === 0;
    if (!ok) anyFailed = true;
    console.log('');
    console.log(`==> ${id}  Status=${r.Status}  ResponseCode=${r.ResponseCode}`);
    if (r.StandardOutputContent && r.StandardOutputContent.trim()) {
      console.log('  --- stdout ---');
      for (const line of r.StandardOutputContent.split('\n')) {
        console.log('   ' + line);
      }
    }
    if (r.StandardErrorContent && r.StandardErrorContent.trim()) {
      console.log('  --- stderr ---');
      for (const line of r.StandardErrorContent.split('\n')) {
        console.log('   ' + line);
      }
    }
  }

  if (anyFailed) {
    console.error('\n[deploy-backend] One or more instances FAILED to deploy.');
    process.exit(1);
  }
  console.log('\n[deploy-backend] All instances updated successfully.');
}

main().catch((e) => {
  console.error('[deploy-backend] FAILED:', e.message);
  if (e.$metadata) console.error(' metadata:', e.$metadata);
  process.exit(1);
});
