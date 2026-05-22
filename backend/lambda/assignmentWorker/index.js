/**
 * Assignment worker — SQS (SNS fan-out) → activity log + CloudWatch metric + assignee email.
 *
 * Env:
 *   DYNAMODB_ACTIVITY_LOG_TABLE
 *   CLOUDWATCH_NAMESPACE (default MiniJira)
 *   EMAIL_USER, EMAIL_PASS — Gmail SMTP (use App Password)
 *
 * SNS Message (from Express assignmentEvents.js) is JSON inside the SNS envelope Message field.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const nodemailer = require('nodemailer');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ACTIVITY_TABLE = process.env.DYNAMODB_ACTIVITY_LOG_TABLE || 'mini-jira-activity-log';
const METRIC_NAMESPACE = process.env.CLOUDWATCH_NAMESPACE || 'MiniJira';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_SMTP_HOST = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
const EMAIL_SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT || 587);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const cw = new CloudWatchClient({ region: REGION });

let mailTransporter;

/** Gmail and Google Workspace (e.g. student.giu-uni.de) use smtp.gmail.com + App Password. */
function resolveSmtpSettings() {
  if (process.env.EMAIL_SMTP_HOST) {
    return { host: EMAIL_SMTP_HOST, port: EMAIL_SMTP_PORT };
  }
  if (EMAIL_USER && EMAIL_PASS) {
    return { host: 'smtp.gmail.com', port: 587 };
  }
  return null;
}

function getMailTransporter() {
  if (!EMAIL_USER || !EMAIL_PASS) return null;
  const smtp = resolveSmtpSettings();
  if (!smtp) {
    console.warn('[email] Cannot send: EMAIL_USER / EMAIL_PASS or EMAIL_SMTP_HOST not configured.');
    return null;
  }
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: false,
      requireTLS: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });
  }
  return mailTransporter;
}

/**
 * SQS body is usually an SNS notification JSON; Message holds our assignment payload.
 * Old SNS console tests send plain text ("SNS test message") — skip those safely.
 */
function parseAssignmentPayload(sqsBody) {
  if (!sqsBody || typeof sqsBody !== 'string') {
    return null;
  }

  let outer;
  try {
    outer = JSON.parse(sqsBody);
  } catch {
    console.warn('[parse] SQS body is not JSON, skipping:', sqsBody.slice(0, 120));
    return null;
  }

  // Rare: payload written directly to the queue without SNS envelope
  if (outer && typeof outer === 'object' && outer.taskId) {
    return outer;
  }

  const raw = outer.Message ?? outer.message;
  if (typeof raw !== 'string' || !raw.trim()) {
    console.warn('[parse] SNS envelope has no Message field');
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed === 'SNS test message' || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    console.warn('[parse] Non-assignment SNS message, skipping:', trimmed.slice(0, 120));
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (err) {
    console.warn('[parse] Message field is not JSON:', err.message, trimmed.slice(0, 120));
    return null;
  }
}

async function saveActivity(payload) {
  const createdAt = payload.createdAt || new Date().toISOString();
  const item = {
    activityId: String(Date.now()),
    taskId: payload.taskId,
    assignee: payload.assignee || payload.assigneeId || 'unknown',
    teamId: payload.teamId || 'unknown',
    action: payload.action || 'assigned',
    createdAt,
  };
  if (payload.assigneeId) item.assigneeId = payload.assigneeId;
  if (payload.title) item.title = payload.title;

  await ddb.send(
    new PutCommand({
      TableName: ACTIVITY_TABLE,
      Item: item,
    })
  );
  console.log('Saved activity:', item);
  return item;
}

async function publishAssignedMetric(teamId) {
  const team = teamId || 'unknown';
  await cw.send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: 'TasksAssignedPerTeam',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date(),
          Dimensions: [{ Name: 'Team', Value: team }],
        },
      ],
    })
  );
  console.log('Published metric TasksAssignedPerTeam', { team });
}

function buildAssignmentEmail(payload) {
  const title = payload.title || 'Untitled task';
  const assignee = payload.assignee || 'there';
  const teamId = payload.teamId || '—';
  const assignedBy = payload.assignedBy || '—';
  const taskId = payload.taskId || '—';

  const subject = `Task assigned: ${title}`;
  const text = `Hello ${assignee},

You have been assigned a new task.

Title: ${title}
Team: ${teamId}
Assigned By: ${assignedBy}

Task ID: ${taskId}`;

  return { subject, text };
}

async function sendAssigneeEmail(payload) {
  const to = payload.assigneeEmail?.trim();
  if (!to) {
    console.warn('[email] Skipped: assigneeEmail missing in payload', {
      taskId: payload.taskId,
    });
    return { sent: false, reason: 'missing_assignee_email' };
  }

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('[email] Skipped: EMAIL_USER or EMAIL_PASS not configured on Lambda');
    return { sent: false, reason: 'missing_smtp_credentials' };
  }

  const { subject, text } = buildAssignmentEmail(payload);

  try {
    const info = await transporter.sendMail({
      from: EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log('[email] Sent successfully', {
      taskId: payload.taskId,
      to,
      messageId: info.messageId,
      response: info.response,
    });
    return { sent: true, messageId: info.messageId, to };
  } catch (err) {
    console.error('[email] Send failed', {
      taskId: payload.taskId,
      to,
      error: err.message,
      code: err.code,
    });
    return { sent: false, reason: 'smtp_error', error: err.message };
  }
}

exports.handler = async (event) => {
  const records = event.Records || [];
  console.log(
    'Assignment worker invoked',
    JSON.stringify({
      recordCount: records.length,
      smtpConfigured: Boolean(EMAIL_USER && EMAIL_PASS),
      activityTable: ACTIVITY_TABLE,
    })
  );

  const results = [];
  for (const record of records) {
    try {
      const payload = parseAssignmentPayload(record.body);
      if (!payload?.taskId) {
        console.warn('Skipping record: not a task assignment payload');
        results.push({ ok: false, reason: 'invalid_or_test_payload' });
        continue;
      }

      const activity = await saveActivity(payload);
      await publishAssignedMetric(payload.teamId);
      const emailResult = await sendAssigneeEmail(payload);

      results.push({
        ok: true,
        taskId: payload.taskId,
        activityId: activity.activityId,
        email: emailResult,
      });
    } catch (err) {
      console.error('Record failed, skipping:', err.message, err.stack);
      results.push({ ok: false, error: err.message });
      // Do NOT re-throw — lets SQS delete the bad message instead of retrying forever
    }
  }

  return { processed: results.length, results };
};