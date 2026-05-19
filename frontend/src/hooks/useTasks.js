import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchTasks } from '@/services/tasksService'

/**
 * Loads tasks with optional manager team filter.
 * @param {{ teamId?: string, projectId?: string, status?: string, enabled?: boolean }} options
 */
export function useTasks({ teamId, projectId, status, enabled = true } = {}) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const params = {}
      if (teamId) params.teamId = teamId
      if (projectId) params.projectId = projectId
      if (status) params.status = status
      const data = await fetchTasks(params)
      setTasks(data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [teamId, projectId, status, enabled])

  useEffect(() => {
    load()
  }, [load])

  return { tasks, setTasks, loading, reload: load }
}
