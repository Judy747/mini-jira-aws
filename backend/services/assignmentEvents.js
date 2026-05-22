const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { loadEnv } = require('../config/env');
const userRepo = require('./userRepository');

const sns = new SNSClient({ region: loadEnv().awsRegion });

/**
 * Publishes a task-assignment event to SNS (fire-and-forget).
 * SNS fans out to SQS → worker Lambda → activity log + CloudWatch metric.
 */
function publishTaskAssignedEvent({
  taskId,
  title,
  teamId,
  assigneeId,
  assignedBy,
}) {
  const topicArn = loadEnv().snsTaskAssignmentTopicArn;
  if (!topicArn) {
    console.warn(
      '[assignmentEvents] SNS publish skipped: SNS_TASK_ASSIGNMENT_TOPIC_ARN is not set'
    );
    return;
  }
  if (!assigneeId) {
    console.warn('[assignmentEvents] SNS publish skipped: missing assigneeId', { taskId });
    return;
  }

  console.log('[assignmentEvents] publishing task assignment to SNS', {
    taskId,
    assigneeId,
    topicArn: topicArn.replace(/:[0-9]{12}:/, ':************:'),
  });

  (async () => {
    let assignee = assigneeId;
    let assigneeEmail = null;
    try {
      const user = await userRepo.getById(assigneeId);
      if (user) {
        assignee = user.name || user.email || assigneeId;
        assigneeEmail = user.email || null;
      }
    } catch (err) {
      console.warn('[assignmentEvents] assignee lookup failed:', err.message);
    }

    const payload = {
      taskId,
      title: title || '',
      teamId,
      assigneeId,
      assignee,
      assigneeEmail,
      action: 'assigned',
      assignedBy: assignedBy || null,
      createdAt: new Date().toISOString(),
    };

    const result = await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `Task assigned: ${title || taskId}`,
        Message: JSON.stringify(payload),
      })
    );
    console.log('[assignmentEvents] SNS publish succeeded', {
      taskId,
      messageId: result.MessageId,
    });
  })().catch((err) => {
    console.error('[assignmentEvents] SNS publish failed:', {
      taskId,
      assigneeId,
      message: err.message,
      code: err.name || err.Code,
    });
  });
}

module.exports = { publishTaskAssignedEvent };
