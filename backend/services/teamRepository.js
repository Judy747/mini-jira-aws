const { GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { teams: table } = loadEnv().dynamo;

async function getById(teamId) {
  const r = await docClient.send(
    new GetCommand({ TableName: table, Key: { teamId } })
  );
  return r.Item || null;
}

async function createTeam(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

async function listTeams() {
  const r = await docClient.send(new ScanCommand({ TableName: table }));
  return r.Items || [];
}

module.exports = { getById, createTeam, listTeams };
