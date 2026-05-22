<<<<<<< HEAD
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
=======
const { PutCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
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

<<<<<<< HEAD
module.exports = { createEntry, listByTask };
=======
async function deleteByTask(taskId) {
  const items = await listByTask(taskId);
  if (!items.length) return;
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }
  for (const batch of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: batch.map((row) => ({
            DeleteRequest: {
              Key: { taskId: row.taskId, auditId: row.auditId },
            },
          })),
        },
      })
    );
  }
}

module.exports = { createEntry, listByTask, deleteByTask };
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
