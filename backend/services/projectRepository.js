const {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { projects: table } = loadEnv().dynamo;
const TEAM_GSI = 'TeamProjectsIndex';

async function getById(projectId) {
  const r = await docClient.send(
    new GetCommand({ TableName: table, Key: { projectId } })
  );
  return r.Item || null;
}

async function putProject(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

async function deleteProject(projectId) {
  await docClient.send(new DeleteCommand({ TableName: table, Key: { projectId } }));
}

/** Query projects visible to a team (server-side) */
async function listByTeam(teamId) {
  const r = await docClient.send(
    new QueryCommand({
      TableName: table,
      IndexName: TEAM_GSI,
      KeyConditionExpression: 'teamId = :t',
      ExpressionAttributeValues: { ':t': teamId },
    })
  );
  return r.Items || [];
}

async function listAllProjects() {
  const r = await docClient.send(new ScanCommand({ TableName: table }));
  return r.Items || [];
}

module.exports = { getById, putProject, deleteProject, listByTeam, listAllProjects };
