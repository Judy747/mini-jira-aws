import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTeams } from '@/hooks/useTeams'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ProfilePage() {
  const { profile } = useAuth()
  const { teams } = useTeams()
  const teamName = useMemo(() => {
    if (!profile?.teamId) return null
    return teams.find((t) => t.teamId === profile.teamId)?.name || null
  }, [teams, profile?.teamId])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your identity and access scope from DynamoDB.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{profile?.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{profile?.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{profile?.role}</Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Team</span>
            <span className="font-medium">{teamName || (profile?.teamId ? 'Unknown team' : '—')}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">User ID</span>
            <span className="break-all font-mono text-xs">{profile?.userId}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
