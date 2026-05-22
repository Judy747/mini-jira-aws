import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchProjects } from '@/services/projectsService'
import { createTask, updateTask } from '@/services/tasksService'
import { api } from '@/services/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TASK_PRIORITIES, priorityLabel } from '@/lib/constants'
import { assigneesForTeam } from '@/lib/assignees'
import { uploadTaskImage } from '@/lib/images'

export function CreateTaskDialog({ teams, onCreated }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const teamAssignees = assigneesForTeam(users, teamId)

  useEffect(() => {
    if (!assigneeId) return
    if (!teamId || !teamAssignees.some((u) => u.userId === assigneeId)) {
      setAssigneeId('')
    }
  }, [teamId, users, assigneeId, teamAssignees])

  useEffect(() => {
    if (!open || !teamId) {
      setProjects([])
      setProjectId('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchProjects({ teamId })
        if (!cancelled) setProjects(data)
      } catch {
        if (!cancelled) setProjects([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, teamId])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  async function submit(e) {
    e.preventDefault()
    if (!teamId || !projectId) {
      toast.error('Select a team and project')
      return
    }
    setBusy(true)
    try {
      const created = await createTask({
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId || null,
        teamId,
        projectId,
      })
      if (imageFile) {
        const images = await uploadTaskImage({
          api,
          file: imageFile,
          taskId: created.taskId,
        })
        await updateTask(created.taskId, images)
      }
      toast.success('Task created')
      setOpen(false)
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setDueDate('')
      setAssigneeId('')
      setTeamId('')
      setProjectId('')
      setImageFile(null)
      onCreated?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create task</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="ct-title">Title</Label>
            <Input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-desc">Description</Label>
            <Textarea id="ct-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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
              <Label htmlFor="ct-due">Due date</Label>
              <Input id="ct-due" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select
              value={assigneeId || '_none'}
              onValueChange={(v) => setAssigneeId(v === '_none' ? '' : v)}
              disabled={!teamId}
            >
              <SelectTrigger>
                <SelectValue placeholder={teamId ? 'Unassigned' : 'Select a team first'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Unassigned</SelectItem>
                {teamAssignees.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamId && teamAssignees.length === 0 && (
              <p className="text-xs text-muted-foreground">No employees on this team yet.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
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
            <Label htmlFor="ct-image">Image (optional)</Label>
            <input
              id="ct-image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={!teamId}>
              <SelectTrigger>
                <SelectValue placeholder={teamId ? 'Select project' : 'Pick a team first'} />
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
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Saving…' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
