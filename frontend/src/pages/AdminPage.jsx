import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Users, Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchTeams,
  fetchUsers,
  createTeam,
  createUser,
} from '@/services/usersService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN']

export function AdminPage() {
  const { isAdmin } = useAuth()

  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)

  const teamNames = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.teamId, t.name])),
    [teams]
  )

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const data = await fetchTeams()
      setTeams(data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load teams')
    } finally {
      setTeamsLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    loadTeams()
    loadUsers()
  }, [isAdmin, loadTeams, loadUsers])

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Manage teams and onboard new users.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Teams</CardTitle>
            </div>
            <CreateTeamDialog onCreated={loadTeams} />
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : teams.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No teams yet. Create one to get started.
              </p>
            ) : (
              <ul className="space-y-2">
                {teams.map((t) => (
                  <li
                    key={t.teamId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{t.teamId}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Users</CardTitle>
            </div>
            <CreateUserDialog teams={teams} onCreated={loadUsers} />
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : users.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No users yet. Create one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {users.map((u) => (
                  <li
                    key={u.userId}
                    className="rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{u.name || u.email}</span>
                      <Badge variant="secondary">{u.role}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{u.email}</span>
                      <span>Team: {u.teamId ? teamNames[u.teamId] || u.teamId : '—'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CreateTeamDialog({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Team name is required')
      return
    }
    setBusy(true)
    try {
      await createTeam({ name: name.trim() })
      toast.success('Team created')
      setName('')
      setOpen(false)
      onCreated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create team')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-3 w-3" />
          New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Teams group employees and scope projects/tasks.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create team'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateUserDialog({ teams, onCreated }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('EMPLOYEE')
  const [teamId, setTeamId] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setEmail('')
    setName('')
    setRole('EMPLOYEE')
    setTeamId('')
    setTemporaryPassword('')
  }

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!temporaryPassword || temporaryPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters')
      return
    }
    if (role === 'EMPLOYEE' && !teamId) {
      toast.error('Employees must be assigned to a team')
      return
    }
    setBusy(true)
    try {
      await createUser({
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        teamId: teamId || undefined,
        temporaryPassword,
      })
      toast.success('User created — share the temporary password with them')
      reset()
      setOpen(false)
      onCreated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-3 w-3" />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Creates a Cognito account + DynamoDB profile. The user will be asked to change
            their temporary password on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-name">Display name (optional)</Label>
            <Input
              id="cu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to email"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team {role === 'EMPLOYEE' ? '' : '(optional)'}</Label>
              <Select value={teamId || '_none'} onValueChange={(v) => setTeamId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {role !== 'EMPLOYEE' && <SelectItem value="_none">None</SelectItem>}
                  {teams.map((t) => (
                    <SelectItem key={t.teamId} value={t.teamId}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-pass">Temporary password</Label>
            <Input
              id="cu-pass"
              type="text"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Min 8 chars; user changes it on first sign-in"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must satisfy your Cognito policy (typically 8+ chars with upper, lower, number,
              and symbol).
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
