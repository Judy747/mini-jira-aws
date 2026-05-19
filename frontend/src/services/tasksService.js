import { api } from '@/services/api'

export async function fetchTasks(params) {
  const { data } = await api.get('/tasks', { params })
  return data
}

export async function fetchTaskSummary(params) {
  const { data } = await api.get('/tasks/summary', { params })
  return data
}

export async function fetchTask(taskId) {
  const { data } = await api.get(`/tasks/${taskId}`)
  return data
}

export async function createTask(payload) {
  const { data } = await api.post('/tasks', payload)
  return data
}

export async function updateTask(taskId, payload) {
  const { data } = await api.put(`/tasks/${taskId}`, payload)
  return data
}

export async function deleteTask(taskId) {
  await api.delete(`/tasks/${taskId}`)
}
