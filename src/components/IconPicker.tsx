import { useState, useMemo, useRef, useEffect } from 'react'
import * as LucideIcons from 'lucide-react'
import { Input } from '@/components/ui/input'

type IconFC = React.FC<{ className?: string }>

const ICON_ENTRIES = (Object.keys(LucideIcons) as string[])
  .filter(key => {
    if (key === 'default' || key === 'createLucideIcon') return false
    if (!/^[A-Z]/.test(key)) return false
    if (key.endsWith('Icon')) return false // skip duplicate *Icon aliases
    const val = (LucideIcons as Record<string, unknown>)[key]
    if (!val || (typeof val !== 'function' && typeof val !== 'object')) return false
    return true
  })
  .map(key => [key, (LucideIcons as unknown as Record<string, IconFC>)[key]] as [string, IconFC])

interface IconPickerProps {
  value: string | null
  onChange: (name: string | null) => void
  placeholder?: string
}

export default function IconPicker({ value, onChange, placeholder = 'Add icon...' }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q === ''
      ? ICON_ENTRIES.slice(0, 120)
      : ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(q)).slice(0, 200)
  }, [query])

  const SelectedIcon = value
    ? (LucideIcons as unknown as Record<string, React.FC<{ className?: string }> | undefined>)[value] ?? null
    : null

  function openPanel() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ x: rect.left - 296, y: rect.top })
    }
    setOpen(true)
  }

  function onDragStart(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const startX = e.clientX - pos.x
    const startY = e.clientY - pos.y

    function onMove(ev: MouseEvent) {
      setPos({ x: ev.clientX - startX, y: ev.clientY - startY })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        className="h-7 px-2 text-xs flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors cursor-pointer"
      >
        {SelectedIcon ? (
          <>
            <SelectedIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{value}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ left: pos.x, top: pos.y, width: 288 }}
          className="fixed z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
        >
          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className="flex justify-center items-center h-6 bg-muted/50 cursor-grab active:cursor-grabbing select-none border-b border-border/40"
          >
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-0.5 h-2.5 rounded-full bg-muted-foreground/30" />
              ))}
            </div>
          </div>

          <div className="p-3">
            <Input
              placeholder="Search icons..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs mb-2"
              autoFocus
            />

            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No icons found</p>
            )}

            <div className="max-h-52 overflow-y-auto">
              <div className="grid grid-cols-8 gap-1">
                {filtered.map(([name, Icon]) => (
                  <button
                    key={name}
                    title={name}
                    onClick={() => { onChange(name); setOpen(false); setQuery('') }}
                    className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-muted ${value === name ? 'bg-accent/20 ring-1 ring-inset ring-accent' : ''}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {value && (
              <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{value}</span>
                <button
                  onClick={() => { onChange(null); setOpen(false) }}
                  className="text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0 cursor-pointer transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
