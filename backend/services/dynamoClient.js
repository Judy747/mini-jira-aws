const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const { loadEnv } = require('../config/env');
const { awsRegion } = loadEnv();

const client = new DynamoDBClient({ region: awsRegion });

/** Document client for simplified attribute marshalling */
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = { docClient };
