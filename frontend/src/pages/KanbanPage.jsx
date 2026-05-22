import { useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { Calendar, GripVertical, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { TeamFilter } from '@/components/TeamFilter'
import { TaskDetailsModal } from '@/components/TaskDetailsModal'
import { useTeams } from '@/hooks/useTeams'
import { useTasks } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { updateTask } from '@/services/tasksService'
import {
  KANBAN_COLUMNS,
  statusLabel,
  priorityLabel,
  priorityVariant,
} from '@/lib/constants'
import { taskImageSrc } from '@/lib/images'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function KanbanPage() {
  const { isManager } = useAuth()
  const { teams } = useTeams()
  const { displayName } = useUsers()
  const [teamFilter, setTeamFilter] = useState('')
  const [modalId, setModalId] = useState(null)
  const [taskRefreshSignal, setTaskRefreshSignal] = useState(0)

  const { tasks, setTasks, loading, reload } = useTasks({
    teamId: isManager && teamFilter ? teamFilter : undefined,
  })

  const grouped = useMemo(() => {
    const g = Object.fromEntries(KANBAN_COLUMNS.map((c) => [c, []]))
    for (const t of tasks) {
      const col = KANBAN_COLUMNS.includes(t.status) ? t.status : 'TODO'
      g[col].push(t)
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
      await updateTask(draggableId, { status: nextStatus })
      toast.success('Task moved')
      await reload()
      setTaskRefreshSignal((n) => n + 1)
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
          <p className="text-muted-foreground">Drag cards between columns — changes persist to DynamoDB.</p>
        </div>
        <TeamFilter teams={teams} value={teamFilter} onChange={setTeamFilter} disabled={loading} />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {KANBAN_COLUMNS.map((c) => (
            <Skeleton key={c} className="h-64" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {KANBAN_COLUMNS.map((col) => (
              <Card key={col} className="bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{statusLabel(col)}</CardTitle>
                  <p className="text-xs text-muted-foreground">{grouped[col].length} tasks</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[220px] space-y-2 rounded-lg border border-dashed p-2 transition-all duration-200 ${
                          snapshot.isDraggingOver
                            ? 'border-primary/60 bg-primary/5 scale-[1.01]'
                            : 'border-border/60'
                        }`}
                      >
                        {grouped[col].length === 0 ? (
                          <p className="py-8 text-center text-xs text-muted-foreground">Drop tasks here</p>
                        ) : (
                          grouped[col].map((task, index) => (
                            <Draggable key={task.taskId} draggableId={task.taskId} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`rounded-lg border bg-background p-3 text-sm shadow-sm transition-shadow ${
                                    dragSnapshot.isDragging
                                      ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                                      : 'border-border'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <button
                                      type="button"
                                      className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted"
                                      aria-label="Drag"
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
                                        <Badge variant={priorityVariant(task.priority)} className="shrink-0 text-[10px]">
                                          {priorityLabel(task.priority)}
                                        </Badge>
                                      </div>
                                      {taskImageSrc(task) && (
                                        <img
                                          src={taskImageSrc(task)}
                                          alt=""
                                          className="mt-2 h-14 w-full rounded object-cover"
                                          loading="lazy"
                                        />
                                      )}
                                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {displayName(task.assigneeId)}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {task.dueDate
                                            ? new Date(task.dueDate).toLocaleDateString()
                                            : 'No due date'}
                                        </span>
                                      </div>
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
        onUpdated={async () => {
          await reload()
          setTaskRefreshSignal((n) => n + 1)
        }}
        refreshSignal={taskRefreshSignal}
      />
    </div>
  )
}
