import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setAuthToken } from '@/services/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'mini_jira_id_token'

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY))

  const setToken = useCallback((t) => {
    setTokenState(t)
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
    setAuthToken(t || null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setProfile(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      setAuthToken(token)
      const { data } = await api.get('/auth/me')
      setProfile(data)
      return data
    } catch {
      setToken('')
      setProfile(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [token, setToken])

  useEffect(() => {
    setAuthToken(token || null)
    refreshProfile()
  }, [token, refreshProfile])

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password })
      setToken(data.idToken)
      return data
    },
    [setToken]
  )

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload)
    return res.data
  }, [])

  const confirmAccount = useCallback(async ({ email, code }) => {
    const res = await api.post('/auth/confirm', { email, code })
    return res.data
  }, [])

  const resendVerificationCode = useCallback(async ({ email }) => {
    const res = await api.post('/auth/resend-code', { email })
    return res.data
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setProfile(null)
  }, [setToken])

  const value = useMemo(
    () => ({
      token,
      profile,
      loading,
      login,
      register,
      confirmAccount,
      resendVerificationCode,
      logout,
      refreshProfile,
      isManager: profile?.role === 'MANAGER' || profile?.role === 'ADMIN',
      isAdmin: profile?.role === 'ADMIN',
    }),
    [token, profile, loading, login, register, confirmAccount, resendVerificationCode, logout, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
