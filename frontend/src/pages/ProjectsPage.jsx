import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export function ProjectsPage() {
  const { isManager } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/projects')
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

  async function createProject(e) {
    e.preventDefault()
    try {
      await api.post('/projects', { name, description, teamId })
      toast.success('Project created')
      setOpen(false)
      setName('')
      setDescription('')
      setTeamId('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Projects are scoped to a team in DynamoDB.</p>
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
              </DialogHeader>
              <form className="space-y-3" onSubmit={createProject}>
                <div className="space-y-2">
                  <Label htmlFor="pname">Name</Label>
                  <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdesc">Description</Label>
                  <Textarea id="pdesc" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pteam">Team ID</Label>
                  <Input id="pteam" value={teamId} onChange={(e) => setTeamId(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full">
                  Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No projects yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.projectId} className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span>{p.name}</span>
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                    {p.teamId?.slice(0, 8)}…
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="line-clamp-3">{p.description || 'No description'}</p>
                <p className="font-mono text-xs">ID: {p.projectId}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
