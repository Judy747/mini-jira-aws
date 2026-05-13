import { useCallback, useEffect, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { TeamFilter } from '@/components/TeamFilter'
import { TaskDetailsModal } from '@/components/TaskDetailsModal'
import { useTeams } from '@/hooks/useTeams'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GripVertical } from 'lucide-react'

const COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done']

/**
 * Kanban board using @hello-pangea/dnd (maintained fork of react-beautiful-dnd, React 18+ compatible).
 */
export function KanbanPage() {
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
      toast.error(e.response?.data?.message || 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [isManager, teamFilter])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const g = Object.fromEntries(COLUMNS.map((c) => [c, []]))
    for (const t of tasks) {
      if (g[t.status]) g[t.status].push(t)
      else g['To Do'].push(t)
    }
    return g
  }, [tasks])

  async function onDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    const nextStatus = destination.droppableId
    const prev = tasks
    setTasks((list) =>
      list.map((t) => (t.taskId === draggableId ? { ...t, status: nextStatus } : t))
    )
    try {
      await api.put(`/tasks/${draggableId}`, { status: nextStatus })
      toast.success('Task moved')
    } catch (e) {
      setTasks(prev)
      toast.error(e.response?.data?.message || 'Could not update status')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kanban</h1>
          <p className="text-muted-foreground">Drag cards across columns. Updates persist via the REST API.</p>
        </div>
        <TeamFilter teams={teams} value={teamFilter} onChange={setTeamFilter} disabled={loading} />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c} className="h-64" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <Card key={col} className="bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{col}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                          snapshot.isDraggingOver ? 'border-primary/60 bg-primary/5' : 'border-border/60'
                        }`}
                      >
                        {grouped[col].length === 0 ? (
                          <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>
                        ) : (
                          grouped[col].map((task, index) => (
                            <Draggable key={task.taskId} draggableId={task.taskId} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`rounded-lg border bg-background p-3 text-sm shadow-sm ${
                                    dragSnapshot.isDragging ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <button
                                      type="button"
                                      className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                      aria-label="Drag task"
                                      {...dragProvided.dragHandleProps}
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="flex-1 text-left"
                                      onClick={() => setModalId(task.taskId)}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="font-medium leading-snug">{task.title}</p>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                          {task.priority}
                                        </Badge>
                                      </div>
                                      {isManager && (
                                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{task.teamId}</p>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            ))}
          </div>
        </DragDropContext>
      )}

      <TaskDetailsModal
        taskId={modalId}
        open={!!modalId}
        onOpenChange={(o) => !o && setModalId(null)}
        onUpdated={load}
      />
    </div>
  )
}
