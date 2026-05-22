import { api } from '@/services/api'

/** Assignment events from SNS → SQS → worker → DynamoDB activity log (managers only). */
export async function fetchAssignmentActivity({ limit = 15 } = {}) {
  const { data } = await api.get('/activity', { params: { limit } })
  return data
}
