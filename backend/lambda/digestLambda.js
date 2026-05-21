/**
 * Daily digest Lambda (Kenzy) — sends a summary email via SNS.
 *
 * EVENTBRIDGE SETUP (run daily at 9:00 AM):
 *   1. AWS Console → EventBridge → Rules → Create rule
 *   2. Schedule: cron(0 9 * * ? *)   ← 09:00 UTC every day (adjust for your timezone)
 *   3. Target: this Lambda function
 *   4. Lambda env: TOPIC_ARN, AWS_REGION (set automatically in Lambda)
 *
 * SNS SETUP:
 *   - Create an SNS topic and email subscription (confirm subscription in inbox)
 *   - Set TOPIC_ARN on the Lambda to that topic ARN
 *
 * IAM (Lambda execution role): sns:Publish on the topic; no extra DynamoDB needed for demo digest.
 */
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DEMO_DIGEST = `
Mini Jira AWS — Daily Digest (demo)

Summary:
- Open tasks reviewed across all teams
- Status changes logged to StatusAudit table
- CloudWatch metrics namespace: MiniJira

This is static demo content. Replace with real aggregates (overdue count, completions, etc.) when ready.

— Mini Jira observability
`.trim();

exports.handler = async () => {
  const topicArn = process.env.TOPIC_ARN;
  if (!topicArn) {
    console.error('[digest] TOPIC_ARN is not set');
    throw new Error('TOPIC_ARN environment variable is required');
  }

  const subject = `Mini Jira Daily Digest — ${new Date().toISOString().slice(0, 10)}`;
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject.slice(0, 100),
      Message: DEMO_DIGEST,
    })
  );

  console.log('[digest] Published daily digest to SNS:', topicArn);
  return { ok: true, topicArn, sentAt: new Date().toISOString() };
};
