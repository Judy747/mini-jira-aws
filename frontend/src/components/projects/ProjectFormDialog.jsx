import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createProject, updateProject } from '@/services/projectsService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

export function ProjectFormDialog({ open, onOpenChange, teams, project, onSaved }) {
  const isEdit = Boolean(project?.projectId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(project?.name || '')
    setDescription(project?.description || '')
    setTeamId(project?.teamId || '')
  }, [open, project])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = { name, description, teamId }
      if (isEdit) {
        await updateProject(project.projectId, payload)
        toast.success('Project updated')
      } else {
        await createProject(payload)
        toast.success('Project created')
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit project' : 'Create project'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="pf-name">Name</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-desc">Description</Label>
            <Textarea id="pf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <Button type="submit" className="w-full" disabled={busy || !teamId}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
