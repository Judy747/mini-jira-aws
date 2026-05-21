const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { statusAudit: table } = loadEnv().dynamo;

/**
 * StatusAudit table: PK taskId, SK auditId (same pattern as Comments).
 */
async function createEntry(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

async function listByTask(taskId) {
  const r = await docClient.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'taskId = :t',
      ExpressionAttributeValues: { ':t': taskId },
    })
  );
  return r.Items || [];
}

module.exports = { createEntry, listByTask };
