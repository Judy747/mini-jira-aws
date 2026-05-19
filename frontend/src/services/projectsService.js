import { api } from '@/services/api'

export async function fetchProjects(params) {
  const { data } = await api.get('/projects', { params })
  return data
}

export async function fetchProject(projectId) {
  const { data } = await api.get(`/projects/${projectId}`)
  return data
}

export async function createProject(payload) {
  const { data } = await api.post('/projects', payload)
  return data
}

export async function updateProject(projectId, payload) {
  const { data } = await api.put(`/projects/${projectId}`, payload)
  return data
}

export async function deleteProject(projectId) {
  await api.delete(`/projects/${projectId}`)
}
