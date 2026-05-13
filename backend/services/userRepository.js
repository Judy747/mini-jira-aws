const { GetCommand, PutCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { users: table } = loadEnv().dynamo;

async function getById(userId) {
  const r = await docClient.send(
    new GetCommand({ TableName: table, Key: { userId } })
  );
  return r.Item || null;
}

async function createUser(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

async function listUsers() {
  const r = await docClient.send(new ScanCommand({ TableName: table }));
  return r.Items || [];
}

async function updateUser(userId, patch) {
  const names = { '#uid': 'userId' };
  const values = {};
  const sets = [];
  let i = 0;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const nk = `#f${i}`;
    const vk = `:v${i}`;
    names[nk] = k;
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
    i += 1;
  }
  if (!sets.length) return getById(userId);
  await docClient.send(
    new UpdateCommand({
      TableName: table,
      Key: { userId },
      UpdateExpression: 'SET ' + sets.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(#uid)',
    })
  );
  return getById(userId);
}

module.exports = { getById, createUser, listUsers, updateUser };
