import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type IconComp = React.ComponentType<{ size?: number; className?: string }>

const allIcons: [string, IconComp][] = (Object.entries(LucideIcons) as [string, unknown][]).filter(
  ([name, comp]) =>
    name[0] === name[0].toUpperCase() &&
    name !== 'default' &&
    typeof comp === 'function',
) as [string, IconComp][]

interface IconPickerProps {
  value: string | null
  onChange: (name: string | null) => void
  placeholder?: string
}

export default function IconPicker({ value, onChange, placeholder = 'Add icon...' }: IconPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query
    ? allIcons.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))
    : allIcons.slice(0, 200)

  const IconComp = value
    ? (LucideIcons as unknown as Record<string, IconComp | undefined>)[value]
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2 font-normal">
          {IconComp ? (
            <>
              <IconComp size={13} />
              <span>{value}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="left" align="start">
        <Input
          placeholder="Search icons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-52 overflow-y-auto">
          <div className="grid grid-cols-8 gap-1">
            {filtered.map(([name, Icon]) => (
              <button
                key={name}
                title={name}
                onClick={() => { onChange(name); setOpen(false) }}
                className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center cursor-pointer hover:bg-muted transition-colors',
                  value === name && 'bg-accent/20 ring-1 ring-accent',
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
            {value ?? 'No icon selected'}
          </span>
          {value && (
            <button
              onClick={() => onChange(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0 ml-2"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
