import { useEffect, useState } from 'react'
import { api } from '@/services/api'

export function useTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/teams')
        if (!cancelled) setTeams(data)
      } catch {
        if (!cancelled) setTeams([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return { teams, loading }
}
