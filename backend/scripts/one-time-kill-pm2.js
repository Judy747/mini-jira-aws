/**
 * One-time cleanup: kill PM2 on each EC2 instance and let systemd own the
 * backend. PM2 was introduced by an earlier PR but conflicts with the
 * systemd unit configured in infra/user-data.sh. After this runs, future
 * deploys via deploy-backend.js / .ps1 will work cleanly.
 *
 * Safe to re-run: if PM2 is already gone, the commands are no-ops.
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

const ec2 = new EC2Client({ region: REGION, maxAttempts: 6 });
const ssm = new SSMClient({ region: REGION, maxAttempts: 6 });

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
  for (const res of r.Reservations || []) for (const i of res.Instances || []) ids.push(i.InstanceId);
  return ids;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ids = await listAsgInstanceIds();
  console.log(`Targeting ${ids.length} instance(s): ${ids.join(', ')}`);
  const cmd = await ssm.send(
    new SendCommandCommand({
      DocumentName: 'AWS-RunShellScript',
      InstanceIds: ids,
      Comment: 'mini-jira: kill PM2, hand backend to systemd',
      TimeoutSeconds: 180,
      Parameters: {
        commands: [
          'set +e',
          'echo "[step] BEFORE:"',
          'sudo ss -tlnp 2>/dev/null | awk "/:4000 /"',
          '',
          'echo "[step] tell PM2 (as root, where the app process lives) to stop and remove the app"',
          'sudo pm2 delete all 2>&1 | tail -10',
          'sudo pm2 kill 2>&1 | tail -5',
          '',
          'echo "[step] disable PM2 auto-start at boot"',
          'sudo systemctl disable --now pm2-root.service 2>&1 | tail -5',
          'sudo systemctl disable --now pm2-miniapp.service 2>&1 | tail -2 || true',
          '',
          'echo "[step] kill stray PM2 god daemons"',
          'sudo pkill -f "PM2 v" 2>&1 || true',
          'sleep 1',
          '',
          'echo "[step] make sure port 4000 is free"',
          'sudo ss -tlnp 2>/dev/null | awk "/:4000 /" || true',
          '',
          'echo "[step] reset systemd restart counter and start mini-jira"',
          'sudo systemctl reset-failed mini-jira.service 2>&1 || true',
          'sudo systemctl restart mini-jira.service',
          'sleep 3',
          '',
          'echo "[step] AFTER:"',
          'sudo systemctl is-active mini-jira.service',
          'sudo ss -tlnp 2>/dev/null | awk "/:4000 /"',
          'sudo journalctl -u mini-jira -n 8 --no-pager',
          '',
          'echo "[step] /health check"',
          'curl -sf http://127.0.0.1:4000/health || echo "HEALTH FAILED"',
        ],
        executionTimeout: ['180'],
      },
    })
  );
  const commandId = cmd.Command.CommandId;
  console.log(`Command ${commandId} dispatched, polling...`);
  await sleep(3000);

  let allOk = true;
  for (const id of ids) {
    for (let j = 0; j < 60; j += 1) {
      try {
        const r = await ssm.send(
          new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: id })
        );
        if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(r.Status)) {
          console.log(`\n==== ${id}  Status=${r.Status}  Exit=${r.ResponseCode} ====`);
          console.log(r.StandardOutputContent || '');
          if (r.StandardErrorContent?.trim()) {
            console.log('--- stderr ---');
            console.log(r.StandardErrorContent);
          }
          if (r.Status !== 'Success') allOk = false;
          break;
        }
      } catch (e) {
        if (e.name !== 'InvocationDoesNotExist') throw e;
      }
      await sleep(3000);
    }
  }

  if (!allOk) {
    console.error('\nOne or more instances did not return Success. See output above.');
    process.exit(1);
  }
  console.log('\nDone. All instances now using systemd; PM2 disabled.');
}

main().catch((e) => {
  console.error('FAILED:', e.name, e.message);
  process.exit(1);
});
