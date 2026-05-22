const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { comments: table } = loadEnv().dynamo;

async function listByTask(taskId) {
  const r = await docClient.send(
    new QueryCommand({
      TableName: table,
      IndexName: 'taskId-index',
      KeyConditionExpression: 'taskId = :t',
      ExpressionAttributeValues: { ':t': taskId },
      ScanIndexForward: true,
    })
  );
  return r.Items || [];
}

async function createComment(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

module.exports = { listByTask, createComment };
