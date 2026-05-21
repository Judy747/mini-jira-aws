/**
 * Creates the StatusAudit DynamoDB table (PK taskId, SK auditId).
 * Usage: node scripts/create-status-audit-table.js
 * Requires AWS credentials and AWS_REGION (or us-east-1 default).
 */
const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');
const { loadEnv } = require('../config/env');

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = loadEnv().dynamo.statusAudit;
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
    return;
  }
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'taskId', AttributeType: 'S' },
        { AttributeName: 'auditId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'taskId', KeyType: 'HASH' },
        { AttributeName: 'auditId', KeyType: 'RANGE' },
      ],
    })
  );
  console.log(`Created table: ${tableName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
