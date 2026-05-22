/**
 * Centralized environment configuration.
 * Validates required variables at startup so misconfiguration fails fast.
 */
require('dotenv').config();

const required = [
  'AWS_REGION',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'DYNAMODB_USERS_TABLE',
  'DYNAMODB_TEAMS_TABLE',
  'DYNAMODB_PROJECTS_TABLE',
  'DYNAMODB_TASKS_TABLE',
  'DYNAMODB_COMMENTS_TABLE',
  'DYNAMODB_STATUS_AUDIT_TABLE',
  'S3_BUCKET_NAME',
];

function loadEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(
      `[config] Missing env: ${missing.join(', ')} — API may fail until these are set.`
    );
  }
  return {
    port: Number(process.env.PORT) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
    cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET || '',
    dynamo: {
      users: process.env.DYNAMODB_USERS_TABLE || 'mini-jira-users',
      teams: process.env.DYNAMODB_TEAMS_TABLE || 'mini-jira-teams',
      projects: process.env.DYNAMODB_PROJECTS_TABLE || 'mini-jira-projects',
      tasks: process.env.DYNAMODB_TASKS_TABLE || 'mini-jira-tasks',
      comments: process.env.DYNAMODB_COMMENTS_TABLE || 'mini-jira-comments',
      statusAudit: process.env.DYNAMODB_STATUS_AUDIT_TABLE || 'mini-jira-status-audit',
      activityLog: process.env.DYNAMODB_ACTIVITY_LOG_TABLE || 'mini-jira-activity-log',
    },
    s3: {
      /** Originals bucket (versioning on in AWS) */
      originalsBucket: process.env.S3_BUCKET_NAME || '',
      originalsPublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
      /** Thumbnails bucket (written by image-resize Lambda) */
      resizedBucket: process.env.S3_RESIZED_BUCKET_NAME || '',
      resizedPublicBaseUrl: process.env.S3_RESIZED_PUBLIC_BASE_URL || '',
      /** @deprecated use originalsBucket — kept for older references */
      bucket: process.env.S3_BUCKET_NAME || '',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
    },
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    /** Task-assignment fan-out (SNS → SQS → worker Lambda) */
    snsTaskAssignmentTopicArn:
      process.env.SNS_TASK_ASSIGNMENT_TOPIC_ARN ||
      process.env.SNS_TOPIC_ARN ||
      '',
  };
}

module.exports = { loadEnv };
