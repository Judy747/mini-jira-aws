require('dotenv').config();
const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: 'us-east-1', maxAttempts: 6 });
const instances = ['i-06a54dd82ea15da9f', 'i-057f3b50ba23ce5a4'];

(async () => {
  const cmd = await ssm.send(new SendCommandCommand({
    DocumentName: 'AWS-RunShellScript',
    InstanceIds: instances,
    Comment: 'mini-jira diagnose port 4000',
    TimeoutSeconds: 60,
    Parameters: {
      commands: [
        'echo === who owns port 4000 ===',
        'sudo ss -tlnp 2>/dev/null | awk "/:4000 /{print}" || true',
        'echo',
        'echo === is PM2 installed for miniapp or root? ===',
        'which pm2 || echo "no global pm2"',
        'ls /home/miniapp/.pm2 2>/dev/null && echo "miniapp has .pm2 dir" || echo "no miniapp .pm2"',
        'ls /root/.pm2 2>/dev/null && echo "root has .pm2 dir" || echo "no root .pm2"',
        'sudo -u miniapp HOME=/home/miniapp pm2 list 2>/dev/null || echo "no miniapp pm2 process"',
        'sudo pm2 list 2>/dev/null || echo "no root pm2 process"',
        'echo',
        'echo === all node and pm2 processes ===',
        'ps -eo pid,user,etime,cmd | grep -E "node|pm2|PM2" | grep -v grep || echo none',
        'echo',
        'echo === systemd services for mini-jira or pm2 ===',
        'systemctl list-unit-files | grep -iE "mini-jira|pm2" || echo "no matching services"',
        'echo',
        'echo === any pm2 startup script? ===',
        'ls /etc/systemd/system/ | grep -iE "pm2" || echo "no pm2 systemd file"',
        'crontab -u miniapp -l 2>/dev/null || true',
        'sudo crontab -l 2>/dev/null || true',
      ],
      executionTimeout: ['60'],
    },
  }));
  const commandId = cmd.Command.CommandId;
  await new Promise((r) => setTimeout(r, 4000));
  for (const id of instances) {
    for (let j = 0; j < 30; j++) {
      try {
        const r = await ssm.send(
          new GetCommandInvocationCommand({ CommandId: commandId, InstanceId: id })
        );
        if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(r.Status)) {
          console.log('\n==== ' + id + ' (' + r.Status + ') ====');
          console.log(r.StandardOutputContent || '');
          if (r.StandardErrorContent?.trim()) {
            console.log('--- stderr ---');
            console.log(r.StandardErrorContent);
          }
          break;
        }
      } catch (e) {
        if (e.name !== 'InvocationDoesNotExist') throw e;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
})().catch((e) => {
  console.error('ERROR:', e.name, e.message);
  process.exit(1);
});
