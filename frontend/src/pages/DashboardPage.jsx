import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { TeamFilter } from '@/components/TeamFilter'
import { TaskDetailsModal } from '@/components/TaskDetailsModal'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { useTeams } from '@/hooks/useTeams'
import { fetchTaskSummary } from '@/services/tasksService'
import { fetchAssignmentActivity } from '@/services/activityService'
import { statusLabel, priorityLabel } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Clock } from 'lucide-react'

export function DashboardPage() {
  const { isManager } = useAuth()
  const { teams } = useTeams()
  const [teamFilter, setTeamFilter] = useState('')
  const [stats, setStats] = useState(null)
  const [recentTasks, setRecentTasks] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [assignmentActivity, setAssignmentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalId, setModalId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (isManager && teamFilter) params.teamId = teamFilter
      const data = await fetchTaskSummary(params)
      setStats(data.stats)
      setRecentTasks(data.recentTasks || [])
      setRecentActivity(data.recentActivity || [])
      if (isManager) {
        try {
          const rows = await fetchAssignmentActivity({ limit: 10 })
          setAssignmentActivity(rows)
        } catch {
          setAssignmentActivity([])
        }
      } else {
        setAssignmentActivity([])
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [isManager, teamFilter])

  useEffect(() => {
    load()
  }, [load])

  const openTasks = recentTasks.filter((t) => t.status !== 'DONE')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {isManager
              ? 'Live metrics from the API with optional team filtering.'
              : 'Tasks and activity for your team only.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {isManager && <CreateTaskDialog teams={teams} onCreated={load} />}
          <TeamFilter teams={teams} value={teamFilter} onChange={setTeamFilter} disabled={loading} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total tasks" value={stats?.total} loading={loading} />
        <StatCard title="Done" value={stats?.done} loading={loading} />
        <StatCard title="In progress" value={stats?.inProgress} loading={loading} />
        <StatCard title="In review" value={stats?.inReview} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Recent tasks</CardTitle>
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
              </div>
            ) : recentTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentTasks.map((t) => (
                  <li key={t.taskId}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-sm hover:bg-muted/40"
                      onClick={() => setModalId(t.taskId)}
                    >
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="secondary">{statusLabel(t.status)}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Recent activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {recentActivity.map((a) => (
                  <li key={`${a.taskId}-${a.at}`} className="border-l-2 border-primary/40 pl-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Status → {statusLabel(a.status)} · {new Date(a.at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment events (SNS pipeline)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rows written by the assignment worker Lambda after SNS → SQS.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : assignmentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignment events yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {assignmentActivity.map((a) => (
                  <li
                    key={a.activityId}
                    className="rounded-md border border-border/60 px-3 py-2"
                  >
                    <p className="font-medium">
                      {a.action || 'assigned'} · {a.assignee || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.title || 'Task'} ·{' '}
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Open work</CardTitle>
            <p className="text-sm text-muted-foreground">Active tasks from your recent feed.</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active tasks.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Priority</th>
                    {isManager && <th className="py-2 pr-4 font-medium">Team</th>}
                    <th className="py-2 font-medium">Due</th>
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
                        <Badge variant="secondary">{statusLabel(t.status)}</Badge>
                      </td>
                      <td className="py-2 pr-4">{priorityLabel(t.priority)}</td>
                      {isManager && (
                        <td className="py-2 pr-4 text-muted-foreground">{t.teamName || '—'}</td>
                      )}
                      <td className="py-2 text-muted-foreground">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
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

function StatCard({ title, value, loading }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{loading ? '—' : value ?? 0}</p>
      </CardContent>
    </Card>
  )
}
