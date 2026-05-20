const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const region = process.env.AWS_REGION || 'us-east-1';

const client = new CloudWatchClient({ region });

const NAMESPACE = 'MiniJira';

/**
 * Publish a single custom metric to CloudWatch (Count unit).
 * Failures are logged and swallowed so API requests are not blocked by observability.
 *
 * @param {string} metricName
 * @param {number} value
 * @param {{ Name: string, Value: string }[]} [dimensions]
 */
async function publishMetric(metricName, value, dimensions = []) {
  const metricDatum = {
    MetricName: metricName,
    Value: value,
    Unit: 'Count',
    Timestamp: new Date(),
  };
  if (dimensions.length > 0) {
    metricDatum.Dimensions = dimensions;
  }

  try {
    await client.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [metricDatum],
      })
    );
    console.log(`[CloudWatch] metric sent: ${metricName} value=${value}`);
  } catch (err) {
    console.error(`[CloudWatch] metric failed: ${metricName}`, err.message || err);
  }
}

module.exports = {
  publishMetric,
};
