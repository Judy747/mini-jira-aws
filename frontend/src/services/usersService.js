import { api } from '@/services/api'

export async function fetchUsers() {
  const { data } = await api.get('/users')
  return data
}

export async function fetchTeams() {
  const { data } = await api.get('/teams')
  return data
}

export async function createTeam(payload) {
  const { data } = await api.post('/teams', payload)
  return data
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload)
  return data
}
