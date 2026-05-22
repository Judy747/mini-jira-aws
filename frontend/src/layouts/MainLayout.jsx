import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Columns3,
  UserCircle,
  LogOut,
  Check,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const linkClass = ({ isActive }) =>
  cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
  )

export function MainLayout() {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-card/40 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-sm">
            <Check className="h-5 w-5" strokeWidth={3} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Mini Jira</p>
            <p className="text-xs text-muted-foreground">Cloud task management</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-4 lg:flex-col">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
          <NavLink to="/projects" className={linkClass}>
            <FolderKanban className="h-4 w-4" />
            Projects
          </NavLink>
          <NavLink to="/board" className={linkClass}>
            <Columns3 className="h-4 w-4" />
            Kanban
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <UserCircle className="h-4 w-4" />
            Profile
          </NavLink>
        </nav>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/30 px-4 py-3 backdrop-blur">
          <div />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{profile?.name || profile?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Signed in</span>
                  <span className="truncate font-medium">{profile?.email}</span>
                  <span className="text-xs text-muted-foreground">Role: {profile?.role}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
