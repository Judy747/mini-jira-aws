import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { TeamFilter } from '@/components/TeamFilter'
import { TaskDetailsModal } from '@/components/TaskDetailsModal'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { useTeams } from '@/hooks/useTeams'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardPage() {
  const { isManager } = useAuth()
  const { teams } = useTeams()
  const [teamFilter, setTeamFilter] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalId, setModalId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (isManager && teamFilter) params.teamId = teamFilter
      const { data } = await api.get('/tasks', { params })
      setTasks(data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [isManager, teamFilter])

  useEffect(() => {
    load()
  }, [load])

  const openTasks = tasks.filter((t) => t.status !== 'Done').slice(0, 8)
  const doneCount = tasks.filter((t) => t.status === 'Done').length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {isManager
              ? 'Organization-wide visibility with optional team filtering (enforced on the server).'
              : 'Tasks for your team only.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {isManager && <CreateTaskDialog teams={teams} onCreated={load} />}
          <TeamFilter teams={teams} value={teamFilter} onChange={setTeamFilter} disabled={loading} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '—' : tasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Done</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '—' : doneCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loading ? '—' : tasks.filter((t) => t.status === 'In Progress').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loading ? '—' : tasks.filter((t) => t.status === 'In Review').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Open work</CardTitle>
            <p className="text-sm text-muted-foreground">Click a row to open details.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active tasks. Great job, or create some work.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Priority</th>
                    {isManager && <th className="py-2 pr-4 font-medium">Team</th>}
                    <th className="py-2 font-medium">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {openTasks.map((t) => (
                    <tr
                      key={t.taskId}
                      className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                      onClick={() => setModalId(t.taskId)}
                    >
                      <td className="py-2 pr-4 font-medium">{t.title}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{t.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">{t.priority}</td>
                      {isManager && (
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.teamId}</td>
                      )}
                      <td className="py-2 text-muted-foreground">
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailsModal
        taskId={modalId}
        open={!!modalId}
        onOpenChange={(o) => !o && setModalId(null)}
        onUpdated={load}
      />
    </div>
  )
}
