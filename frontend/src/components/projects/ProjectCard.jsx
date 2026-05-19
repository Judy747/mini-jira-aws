import { Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ProjectCard({ project, teamName, isManager, onEdit, onDelete }) {
  return (
    <Card className="border-border/80 transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <span>{project.name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {teamName || project.teamId?.slice(0, 8)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p className="line-clamp-3">{project.description || 'No description'}</p>
        <p className="text-xs">
          Created {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
        </p>
        {isManager && (
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(project)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(project)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
