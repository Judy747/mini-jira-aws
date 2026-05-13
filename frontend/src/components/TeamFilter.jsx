import { useAuth } from '@/context/AuthContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

/**
 * Manager-only control: drives `teamId` query param so filtering stays authoritative on the server.
 */
export function TeamFilter({ teams, value, onChange, disabled }) {
  const { isManager } = useAuth()
  if (!isManager) return null

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Label className="text-muted-foreground sm:min-w-[5rem]">Team filter</Label>
      <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)} disabled={disabled}>
        <SelectTrigger className="sm:w-72">
          <SelectValue placeholder="All teams" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All teams</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.teamId} value={t.teamId}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
