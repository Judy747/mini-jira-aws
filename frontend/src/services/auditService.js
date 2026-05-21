import { api } from '@/services/api'

export async function fetchAuditForTask(taskId) {
  const { data } = await api.get(`/audit/${taskId}`)
  return data
}
