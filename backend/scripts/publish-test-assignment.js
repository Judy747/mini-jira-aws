/**
 * Publish a real-shaped assignment event to SNS (same JSON as the Express API).
 * Usage: node scripts/publish-test-assignment.js [assigneeEmail]
 */
require('dotenv').config();
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TOPIC_ARN =
  process.env.SNS_TASK_ASSIGNMENT_TOPIC_ARN ||
  'arn:aws:sns:us-east-1:744683930574:mini-jira-task-assignments';

const assigneeEmail = process.argv[2] || 'Jannasaeed2005@gmail.com';

const payload = {
  taskId: `diag-${Date.now()}`,
  title: 'Pipeline smoke test',
  teamId: 'frontend',
  assigneeId: 'test-user',
  assignee: 'Jana Saeed',
  assigneeEmail,
  action: 'assigned',
  assignedBy: 'publish-test-assignment.js',
  createdAt: new Date().toISOString(),
};

async function main() {
  if (!TOPIC_ARN) {
    console.error('Set SNS_TASK_ASSIGNMENT_TOPIC_ARN in backend/.env');
    process.exit(1);
  }
  const sns = new SNSClient({ region: REGION });
  const r = await sns.send(
    new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: `Task assigned: ${payload.title}`,
      Message: JSON.stringify(payload),
    })
  );
  console.log('Published to SNS:', TOPIC_ARN);
  console.log('MessageId:', r.MessageId);
  console.log('Payload assigneeEmail:', assigneeEmail);
  console.log('Check CloudWatch /aws/lambda/mini-jira-assignment-worker in ~30s');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
