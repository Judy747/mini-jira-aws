import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'

/** Manager/admin directory for assignee labels */
export function useUsers() {
  const { isManager } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isManager) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/users')
        if (!cancelled) setUsers(data)
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isManager])

  const byId = Object.fromEntries(users.map((u) => [u.userId, u]))

  function displayName(userId) {
    if (!userId) return 'Unassigned'
    const u = byId[userId]
    return u?.name || u?.email || `${userId.slice(0, 8)}…`
  }

  return { users, loading, displayName }
}
