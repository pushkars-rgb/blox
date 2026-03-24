import { useState } from 'react'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { type Project } from '@/data/projects'
import useProjects from '@/hooks/useProjects'
import { Check, LayoutGrid, MoreVertical, Plus, Settings, Share2, Trash2 } from 'lucide-react'

// ─── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar() {
  const { signOut } = useClerk()
  const { user } = useUser()

  const name = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'You'
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Wordmark */}
      <div className="flex items-center px-4 py-4">
        <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-5" />
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-1">
        <button className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors bg-sidebar-accent text-sidebar-accent-foreground">
          <LayoutGrid size={15} strokeWidth={1.75} />
          Projects
        </button>
      </nav>

      {/* User row */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-xs font-medium text-sidebar-foreground">
          {name}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">
              <Settings size={14} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-44">
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

// ─── Project Card ────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project
  onDeleteRequest: (project: Project) => void
}

function ProjectCard({ project, onDeleteRequest }: ProjectCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  // Use the active theme dots saved by the editor, fall back to project's original colors
  const displayColors: string[] = (() => {
    try {
      const raw = localStorage.getItem(`blox_active_dots_${project.id}`)
      return raw ? (JSON.parse(raw) as string[]) : project.colors
    } catch { return project.colors }
  })()

  return (
    <Card
      onClick={() => navigate(`/editor/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer rounded-xl p-0 gap-0 border border-border/40 shadow-none transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-border/70 hover:shadow-sm"
    >
      {/* Header row: name + meta + kebab */}
      <CardHeader className="px-4 pt-4 pb-3 gap-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-semibold text-sm text-foreground leading-tight block">
              {project.name}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5 block">
              {project.componentCount} components · {project.lastEdited}
            </span>
          </div>
          <div className={cn('transition-opacity duration-150 shrink-0 -mt-0.5', hovered ? 'opacity-100' : 'opacity-0')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors cursor-pointer"
                >
                  <MoreVertical size={14} strokeWidth={1.75} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); console.log('Share:', project.id) }}
                >
                  <Share2 size={13} className="mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDeleteRequest(project) }}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 size={13} className="mr-2" style={{ color: 'var(--destructive)' }} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {/* Color dots */}
      <CardFooter className="px-4 pt-3 pb-4 bg-transparent">
        <div className="flex gap-1.5">
          {displayColors.map((color) => (
            <span
              key={color}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}

// ─── New Project Dialog ──────────────────────────────────────────────────────

const PALETTES = [
  { name: 'Sunrise',  colors: ['#F97316', '#FBBF24', '#FDE68A'] as [string, string, string] },
  { name: 'Midnight', colors: ['#1E3A5F', '#3B82F6', '#93C5FD'] as [string, string, string] },
  { name: 'Forest',   colors: ['#14532D', '#22C55E', '#86EFAC'] as [string, string, string] },
  { name: 'Blush',    colors: ['#881337', '#F43F5E', '#FDA4AF'] as [string, string, string] },
  { name: 'Aurora',   colors: ['#4C1D95', '#8B5CF6', '#DDD6FE'] as [string, string, string] },
]

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (project: Project) => void
}

function NewProjectDialog({ open, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('')
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null)

  function handleCreate() {
    if (!name.trim() || !selectedPalette) return
    const palette = PALETTES.find((p) => p.name === selectedPalette)!
    const project: Project = {
      id: Date.now().toString(),
      name: name.trim(),
      componentCount: Math.floor(Math.random() * 5) + 1,
      lastEdited: 'Just now',
      colors: palette.colors,
      primaryColor: palette.colors[0],
    }
    onCreate(project)
    handleClose()
  }

  function handleClose() {
    onOpenChange(false)
    setName('')
    setSelectedPalette(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Name your project, then pick a starting palette for your design tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Project name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Project name</label>
            <Input
              placeholder="e.g. Sunrise UI"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 rounded-md text-sm"
            />
          </div>

          {/* Palette picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground">Starting palette</label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose a palette to set the starting color tokens for your project.
            </p>
            <div className="flex flex-col gap-1">
              {PALETTES.map((palette) => {
                const isSelected = selectedPalette === palette.name
                return (
                  <button
                    key={palette.name}
                    onClick={() => setSelectedPalette(palette.name)}
                    className={[
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-100',
                      isSelected
                        ? 'bg-muted border border-border text-foreground'
                        : 'text-foreground hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <div className="flex gap-1.5">
                      {palette.colors.map((color) => (
                        <span
                          key={color}
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span className="flex-1 text-left">{palette.name}</span>
                    {isSelected && (
                      <Check size={13} strokeWidth={2} className="text-foreground/60" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="rounded-md" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-md"
            disabled={name.trim() === '' || selectedPalette === null}
            onClick={handleCreate}
          >
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { projects, addProject, deleteProject } = useProjects()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProjectToDelete, setSelectedProjectToDelete] = useState<Project | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  function handleCreate(project: Project) {
    addProject(project)
    navigate(`/editor/${project.id}`)
  }

  function handleDeleteCancel() {
    setSelectedProjectToDelete(null)
    setDeleteConfirmText('')
  }

  function handleDeleteConfirm() {
    if (!selectedProjectToDelete) return
    deleteProject(selectedProjectToDelete.id)
    setSelectedProjectToDelete(null)
    setDeleteConfirmText('')
  }

  return (
    <div className="flex h-screen bg-background font-sans">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {projects.length > 0 ? (
          <>
            {/* Topbar */}
            <header className="flex items-center justify-between border-b border-border px-6 py-3">
              <h1 className="text-sm font-semibold text-foreground">Projects</h1>
              <Button
                size="sm"
                className="h-8 rounded-md gap-1.5 text-xs px-3"
                onClick={() => setDialogOpen(true)}
              >
                <Plus size={13} strokeWidth={2} />
                New Design System
              </Button>
            </header>

            {/* Grid */}
            <main className="flex-1 overflow-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDeleteRequest={setSelectedProjectToDelete}
                  />
                ))}
              </div>
            </main>
          </>
        ) : (
          /* Empty state */
          <main className="flex flex-1 items-center justify-center">
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
              <LayoutGrid
                className="mb-2 h-10 w-10 text-muted-foreground"
                strokeWidth={1.5}
              />
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold text-foreground">
                  Start with a design system
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create your first project to start configuring components and exporting design tokens for your team.
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                + New Design System
              </Button>
            </div>
          </main>
        )}
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={selectedProjectToDelete !== null}
        onOpenChange={(open) => { if (!open) handleDeleteCancel() }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete design system</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                This will permanently delete{' '}
                <span className="font-medium text-foreground">
                  {selectedProjectToDelete?.name}
                </span>{' '}
                and all its configured components. This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-1 py-2">
            <label className="text-xs text-muted-foreground mb-1">
              Type the project name to confirm
            </label>
            <Input
              placeholder={selectedProjectToDelete?.name ?? ''}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="h-8 rounded-md text-sm"
            />
          </div>

          <AlertDialogFooter>
            <Button variant="outline" size="sm" className="rounded-md" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="rounded-md"
              disabled={deleteConfirmText !== selectedProjectToDelete?.name}
              onClick={handleDeleteConfirm}
            >
              Delete project
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
