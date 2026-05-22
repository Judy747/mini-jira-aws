const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const TABLE = () => loadEnv().dynamo.activityLog;

async function listRecent(limit = 25) {
  const { Items = [] } = await docClient.send(
    new ScanCommand({
      TableName: TABLE(),
      Limit: Math.min(limit, 100),
    })
  );
  return Items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit);
}

module.exports = { listRecent };
