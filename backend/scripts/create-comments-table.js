/**
 * Creates the Comments DynamoDB table (PK taskId, SK commentId).
 * Usage: node scripts/create-comments-table.js
 * Requires AWS credentials and AWS_REGION (or us-east-1 default).
 *
 * Why this schema:
 *   The backend queries comments by taskId via
 *     QueryCommand({ KeyConditionExpression: 'taskId = :t' })
 *   which requires taskId to be the partition key. commentId is the
 *   sort key so multiple comments per task can coexist.
 */
const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');
const { loadEnv } = require('../config/env');

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = loadEnv().dynamo.comments;
const client = new DynamoDBClient({ region });

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
}

async function main() {
  if (await tableExists()) {
    console.log(`Table already exists: ${tableName}`);
    console.log(
      'If its schema is wrong (PK must be taskId, SK must be commentId), ' +
        'delete it first via the AWS console or:\n' +
        `  aws dynamodb delete-table --table-name ${tableName} --region ${region}\n` +
        'then re-run this script.'
    );
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'taskId', AttributeType: 'S' },
        { AttributeName: 'commentId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'taskId', KeyType: 'HASH' },
        { AttributeName: 'commentId', KeyType: 'RANGE' },
      ],
    })
  );
  console.log(`Created table: ${tableName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
