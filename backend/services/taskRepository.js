const {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');
const { loadEnv } = require('../config/env');

const { tasks: table } = loadEnv().dynamo;
const GSI_TEAM = 'TeamTasksIndex';
const GSI_ASSIGNEE = 'AssigneeTasksIndex';

async function getById(taskId) {
  const r = await docClient.send(
    new GetCommand({ TableName: table, Key: { taskId } })
  );
  return r.Item || null;
}

async function putTask(item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

async function deleteTask(taskId) {
  await docClient.send(new DeleteCommand({ TableName: table, Key: { taskId } }));
}

/**
 * All tasks for a team — filtering by projectId/status happens in service layer
 * using FilterExpression to keep reads scoped to the team partition (GSI).
 */
async function queryByTeam(teamId, filters = {}) {
  let fe = '';
  const exprNames = {};
  const exprValues = { ':teamId': teamId };

  if (filters.projectId) {
    exprNames['#p'] = 'projectId';
    exprValues[':pid'] = filters.projectId;
    fe += (fe ? ' AND ' : '') + '#p = :pid';
  }
  if (filters.status) {
    exprNames['#s'] = 'status';
    exprValues[':st'] = filters.status;
    fe += (fe ? ' AND ' : '') + '#s = :st';
  }

  const params = {
    TableName: table,
    IndexName: GSI_TEAM,
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: exprValues,
  };
  if (fe) {
    params.FilterExpression = fe;
    params.ExpressionAttributeNames = exprNames;
  }

  const r = await docClient.send(new QueryCommand(params));
  return r.Items || [];
}

async function queryByAssignee(assigneeId) {
  const r = await docClient.send(
    new QueryCommand({
      TableName: table,
      IndexName: GSI_ASSIGNEE,
      KeyConditionExpression: 'assigneeId = :a',
      ExpressionAttributeValues: { ':a': assigneeId },
    })
  );
  return r.Items || [];
}

module.exports = {
  getById,
  putTask,
  deleteTask,
  queryByTeam,
  queryByAssignee,
};
