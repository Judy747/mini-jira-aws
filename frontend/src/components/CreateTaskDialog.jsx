import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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

const PRIORITIES = ['Low', 'Medium', 'High']

/**
 * Manager workflow: create a task scoped to team + project (server validates access patterns via role).
 */
export function CreateTaskDialog({ teams, onCreated }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [deadline, setDeadline] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !teamId) {
      setProjects([])
      setProjectId('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/projects', { params: { teamId } })
        if (!cancelled) setProjects(data)
      } catch {
        if (!cancelled) setProjects([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, teamId])

  async function submit(e) {
    e.preventDefault()
    if (!teamId || !projectId) {
      toast.error('Select a team and project')
      return
    }
    setBusy(true)
    try {
      await api.post('/tasks', {
        title,
        description,
        priority,
        deadline: deadline || null,
        assigneeId: assigneeId || null,
        teamId,
        projectId,
      })
      toast.success('Task created')
      setOpen(false)
      setTitle('')
      setDescription('')
      setPriority('Medium')
      setDeadline('')
      setAssigneeId('')
      setTeamId('')
      setProjectId('')
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
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-deadline">Deadline</Label>
              <Input id="ct-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-assignee">Assignee user ID (optional)</Label>
            <Input
              id="ct-assignee"
              placeholder="Cognito sub"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            />
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
