import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { fetchTask, updateTask } from '@/services/tasksService'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { TASK_STATUSES, statusLabel, priorityLabel } from '@/lib/constants'

export function TaskDetailsModal({ taskId, open, onOpenChange, onUpdated }) {
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [t, cRes] = await Promise.all([
          fetchTask(taskId),
          api.get(`/comments/${taskId}`),
        ])
        if (!cancelled) {
          setTask(t)
          setComments(cRes.data)
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
    try {
      const { data: presign } = await api.post('/uploads/presign', {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
      })
      await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      const updated = await updateTask(taskId, { imageUrl: presign.publicUrl })
      setTask(updated)
      toast.success('Attachment saved')
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function changeStatus(status) {
    try {
      const updated = await updateTask(taskId, { status })
      setTask(updated)
      toast.success('Status updated')
      onUpdated?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed')
    }
  }

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
            {task.imageUrl && (
              <a href={task.imageUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                View attachment
              </a>
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
