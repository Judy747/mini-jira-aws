import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useTeams } from '@/hooks/useTeams'
import { fetchProjects, deleteProject } from '@/services/projectsService'
import { ProjectFormDialog } from '@/components/projects/ProjectFormDialog'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ProjectsPage() {
  const { isManager } = useAuth()
  const { teams } = useTeams()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const teamNames = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.teamId, t.name])),
    [teams]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(project) {
    setEditing(project)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteProject(deleting.projectId)
      toast.success('Project deleted')
      setDeleting(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Team-scoped workspaces for your tasks.</p>
        </div>
        {isManager && <Button onClick={openCreate}>New project</Button>}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No projects yet.
            {isManager && ' Create one to organize tasks.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.projectId}
              project={p}
              teamName={teamNames[p.teamId]}
              isManager={isManager}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {isManager && (
        <ProjectFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          teams={teams}
          project={editing}
          onSaved={load}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This removes <strong>{deleting?.name}</strong>. Tasks linked to this project may become orphaned.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
