import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
<<<<<<< HEAD
import { fetchTask, updateTask } from '@/services/tasksService'
import { fetchAuditForTask } from '@/services/auditService'
=======
import { fetchTask, updateTask, deleteTask } from '@/services/tasksService'
import { fetchAuditForTask } from '@/services/auditService'
import { fetchProjects } from '@/services/projectsService'
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
import { taskImageSrc, uploadTaskImage } from '@/lib/images'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
<<<<<<< HEAD
=======
import { Input } from '@/components/ui/input'
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
<<<<<<< HEAD
import { TASK_STATUSES, statusLabel, priorityLabel } from '@/lib/constants'

export function TaskDetailsModal({ taskId, open, onOpenChange, onUpdated }) {
=======
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  statusLabel,
  priorityLabel,
} from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { useTeams } from '@/hooks/useTeams'

// datetime-local needs "YYYY-MM-DDTHH:mm" (no seconds, no Z) in local tz
function toDateTimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}

export function TaskDetailsModal({ taskId, open, onOpenChange, onUpdated, refreshSignal = 0 }) {
  const { isManager } = useAuth()
  const { teams } = useTeams()

>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [thumbError, setThumbError] = useState(false)

<<<<<<< HEAD
=======
  // edit-mode state (managers only)
  const [editMode, setEditMode] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [draft, setDraft] = useState(null)
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [deleting, setDeleting] = useState(false)

>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setThumbError(false)
<<<<<<< HEAD
=======
      setEditMode(false)
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
      try {
        const [t, cRes, auditRows] = await Promise.all([
          fetchTask(taskId),
          api.get(`/comments/${taskId}`),
          fetchAuditForTask(taskId).catch(() => []),
        ])
        if (!cancelled) {
          setTask(t)
          setComments(cRes.data)
          setAudit(auditRows)
        }
      } catch (e) {
        if (!cancelled) toast.error(e.response?.data?.message || 'Failed to load task')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, taskId])

<<<<<<< HEAD
=======
  useEffect(() => {
    if (!open || !taskId || refreshSignal === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const [t, auditRows] = await Promise.all([
          fetchTask(taskId),
          fetchAuditForTask(taskId).catch(() => []),
        ])
        if (!cancelled) {
          setTask(t)
          setAudit(auditRows)
        }
      } catch {
        /* non-blocking */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal, open, taskId])

  // Load users (assignee picker) once in edit mode for managers
  useEffect(() => {
    if (!editMode || !isManager) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/users')
        if (!cancelled) setUsers(data)
      } catch {
        if (!cancelled) setUsers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editMode, isManager])

  // Load projects for the draft's team whenever the team changes in edit mode
  useEffect(() => {
    if (!editMode || !draft?.teamId) {
      setProjects([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchProjects({ teamId: draft.teamId })
        if (!cancelled) setProjects(data)
      } catch {
        if (!cancelled) setProjects([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editMode, draft?.teamId])

>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
  async function addComment() {
    if (!commentText.trim()) return
    try {
      const { data } = await api.post('/comments', { taskId, text: commentText.trim() })
      setComments((c) => [...c, data])
      setCommentText('')
      toast.success('Comment added')
      onUpdated?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add comment')
    }
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    if (!file || !taskId) return
    setUploading(true)
    setThumbError(false)
    try {
      const images = await uploadTaskImage({ api, file, taskId })
      const updated = await updateTask(taskId, images)
      setTask(updated)
      toast.success('Attachment saved — thumbnail may take a few seconds')
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function reloadAudit() {
    if (!taskId) return
    try {
      const rows = await fetchAuditForTask(taskId)
      setAudit(rows)
    } catch {
      /* non-blocking */
    }
  }

  async function changeStatus(status) {
    try {
      const updated = await updateTask(taskId, { status })
      setTask(updated)
      await reloadAudit()
      toast.success('Status updated')
      onUpdated?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed')
    }
  }

<<<<<<< HEAD
=======
  function startEdit() {
    if (!task) return
    setDraft({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'MEDIUM',
      status: task.status || 'TODO',
      dueDate: toDateTimeLocalValue(task.dueDate),
      assigneeId: task.assigneeId || '',
      teamId: task.teamId || '',
      projectId: task.projectId || '',
    })
    setEditMode(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditMode(false)
  }

  async function handleDelete() {
    if (!taskId) return
    const confirmed = window.confirm(
      `Delete task "${task?.title || taskId}"? This will also remove its comments, audit history, and any attached image. This cannot be undone.`
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteTask(taskId)
      toast.success('Task deleted')
      onUpdated?.()
      onOpenChange?.(false)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete task')
    } finally {
      setDeleting(false)
    }
  }

  async function saveEdit() {
    if (!draft) return
    if (!draft.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!draft.teamId) {
      toast.error('Team is required')
      return
    }
    if (!draft.projectId) {
      toast.error('Project is required')
      return
    }
    setSavingEdit(true)
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        status: draft.status,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
        assigneeId: draft.assigneeId || null,
        teamId: draft.teamId,
        projectId: draft.projectId,
      }
      const updated = await updateTask(taskId, payload)
      setTask(updated)
      await reloadAudit()
      toast.success('Task updated')
      onUpdated?.()
      setEditMode(false)
      setDraft(null)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update task')
    } finally {
      setSavingEdit(false)
    }
  }

>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
  const previewSrc = task ? taskImageSrc(task) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task?.title || 'Task'}</DialogTitle>
          <DialogDescription>Details, comments, and attachments.</DialogDescription>
        </DialogHeader>
        {loading || !task ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
<<<<<<< HEAD
            <div className="flex flex-wrap gap-2">
              <Badge>{priorityLabel(task.priority)}</Badge>
              <Badge variant="secondary">{statusLabel(task.status)}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">Due date</span>
                <div>{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Team</span>
                <div className="font-mono">{task.teamId}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Project</span>
                <div className="font-mono">{task.projectId}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">Assignee</span>
                <div className="font-mono">{task.assigneeId || '—'}</div>
              </div>
            </div>
=======
            {isManager && !editMode && (
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={startEdit}>
                  Edit details
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete task'}
                </Button>
              </div>
            )}

            {editMode && draft ? (
              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label htmlFor="ed-title">Title</Label>
                  <Input
                    id="ed-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-desc">Description</Label>
                  <Textarea
                    id="ed-desc"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={draft.priority}
                      onValueChange={(v) => setDraft({ ...draft, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityLabel(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(v) => setDraft({ ...draft, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-due">Due date</Label>
                  <Input
                    id="ed-due"
                    type="datetime-local"
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={draft.assigneeId || '_none'}
                    onValueChange={(v) =>
                      setDraft({ ...draft, assigneeId: v === '_none' ? '' : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.userId} value={u.userId}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select
                      value={draft.teamId}
                      onValueChange={(v) =>
                        setDraft({ ...draft, teamId: v, projectId: '' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.teamId} value={t.teamId}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={draft.projectId}
                      onValueChange={(v) => setDraft({ ...draft, projectId: v })}
                      disabled={!draft.teamId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={draft.teamId ? 'Select project' : 'Pick team first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.projectId} value={p.projectId}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge>{priorityLabel(task.priority)}</Badge>
                  <Badge variant="secondary">{statusLabel(task.status)}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-foreground">Due date</span>
                    <div>{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Team</span>
                    <div className="font-mono">{task.teamId}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Project</span>
                    <div className="font-mono">{task.projectId}</div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Assignee</span>
                    <div className="font-mono">{task.assigneeId || '—'}</div>
                  </div>
                </div>
              </>
            )}

>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
            {previewSrc && (
              <div className="space-y-2">
                <Label className="text-foreground">Attachment</Label>
                {!thumbError ? (
                  <a href={task.imageUrl || previewSrc} target="_blank" rel="noreferrer">
                    <img
                      src={previewSrc}
                      alt="Task attachment"
                      className="max-h-48 w-full rounded-md border border-border object-contain bg-muted/30"
                      onError={() => setThumbError(true)}
                    />
                  </a>
                ) : (
                  <a
                    href={task.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View full image
                  </a>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {TASK_STATUSES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={task.status === s ? 'default' : 'outline'}
                    onClick={() => changeStatus(s)}
                  >
                    {statusLabel(s)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach">Image attachment</Label>
              <input id="attach" type="file" accept="image/*" onChange={onPickFile} disabled={uploading} />
              {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Audit Timeline</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {audit.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No status changes recorded yet.</p>
                ) : (
                  audit.map((a) => (
                    <div key={a.auditId} className="border-l-2 border-primary/50 pl-2 text-sm">
                      <p className="font-medium">{a.changedByName || a.changedBy}</p>
                      <p className="text-muted-foreground">
<<<<<<< HEAD
                        {statusLabel(a.fromStatus)} → {statusLabel(a.toStatus)}
=======
                        {a.fromStatus ? statusLabel(a.fromStatus) : 'Created'} →{' '}
                        {statusLabel(a.toStatus)}
>>>>>>> bbca33f6f623f9918dc59d6d5462ca10c0792f7c
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.changedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label>Comments</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.commentId} className="rounded-md bg-muted/40 p-2 text-sm">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{c.authorName}</span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
              <Textarea
                placeholder="Write a comment…"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <Button type="button" onClick={addComment}>
                Add comment
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
