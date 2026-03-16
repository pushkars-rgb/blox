import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectTokens, injectTokens } from '@/hooks/useProjectTokens'
import * as LucideIcons from 'lucide-react'
import IconPicker from '@/components/IconPicker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import ColorPicker from '@/components/ColorPicker'
import { type Project } from '@/data/projects'
import { Check, ChevronDown, ChevronLeft, Download, LayoutGrid, Loader2 } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaddingValue = { top: number; right: number; bottom: number; left: number }
type ComponentPropsValue = string | boolean | number | PaddingValue | undefined
type ComponentProps = Record<string, ComponentPropsValue>
type UpdateProp = (key: string, value: ComponentPropsValue) => void

type InspectorSharedProps = {
  props: ComponentProps
  updateProp: UpdateProp
  paletteColors: string[]
  primaryColor: string
  globalRadius: number
  onChangeGlobalRadius: (v: number) => void
}

const defaultPadding: PaddingValue = { top: 8, right: 16, bottom: 8, left: 16 }

type LucideIconComp = React.ComponentType<{ size?: number; className?: string }>

// ─── Theme presets ────────────────────────────────────────────────────────────

const SHADCN_PRESETS = [
  { name: 'Default',  primary: '#18181b', colors: ['#18181b', '#71717a', '#e4e4e7'] },
  { name: 'Zinc',     primary: '#3f3f46', colors: ['#3f3f46', '#71717a', '#d4d4d8'] },
  { name: 'Slate',    primary: '#1e293b', colors: ['#1e293b', '#64748b', '#cbd5e1'] },
  { name: 'Stone',    primary: '#1c1917', colors: ['#1c1917', '#78716c', '#d6d3d1'] },
  { name: 'Blue',     primary: '#2563eb', colors: ['#2563eb', '#3b82f6', '#93c5fd'] },
  { name: 'Violet',   primary: '#7c3aed', colors: ['#7c3aed', '#8b5cf6', '#c4b5fd'] },
  { name: 'Rose',     primary: '#e11d48', colors: ['#e11d48', '#f43f5e', '#fda4af'] },
  { name: 'Orange',   primary: '#ea580c', colors: ['#ea580c', '#f97316', '#fdba74'] },
  { name: 'Green',    primary: '#16a34a', colors: ['#16a34a', '#22c55e', '#86efac'] },
]

// ─── CSS var helpers ─────────────────────────────────────────────────────────

const CSS_PRIMARY = 'hsl(var(--primary))'
const CSS_PRIMARY_FG = 'hsl(var(--primary-foreground))'

// ─── Component list ───────────────────────────────────────────────────────────

const COMPONENTS = [
  'Alert', 'Avatar', 'Badge', 'Bar Chart', 'Breadcrumb', 'Button', 'Button Group',
  'Calendar', 'Card', 'Checkbox',
  'Dialog', 'Dropdown Menu', 'Input', 'Label', 'Line Chart', 'Popover', 'Progress',
  'Radio Group', 'Select', 'Separator', 'Sheet', 'Sidebar', 'Skeleton', 'Slider',
  'Switch', 'Table', 'Tabs', 'Textarea', 'Toast', 'Toggle', 'Tooltip',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadProject(projectId: string): Project | null {
  try {
    const raw = localStorage.getItem('blox_projects')
    if (!raw) return null
    const list = JSON.parse(raw) as Project[]
    return list.find((p) => p.id === projectId) ?? null
  } catch {
    return null
  }
}

function getPropsKey(projectId: string) {
  return `blox_component_props_${projectId}`
}

function shadowValue(shadow: string | undefined): string | undefined {
  if (shadow === 'sm') return '0 1px 2px 0 rgba(0,0,0,0.05)'
  if (shadow === 'md') return '0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06)'
  if (shadow === 'lg') return '0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05)'
  if (shadow === 'none') return 'none'
  return undefined
}

// ─── Code generation ──────────────────────────────────────────────────────────

function generateTSX(
  component: string,
  props: ComponentProps,
): { full: string; usage: string } {
  if (component === 'Button') {
    const variant = (props.variant as string) ?? 'default'
    const size = (props.size as string) ?? 'default'
    const label = (props.label as string) ?? 'Button'
    const fullWidth = (props.fullWidth as boolean) ?? false
    const parts: string[] = []
    if (variant !== 'default') parts.push(`variant="${variant}"`)
    if (size !== 'default') parts.push(`size="${size}"`)
    if (fullWidth) parts.push(`className="w-full"`)
    const p = parts.length ? ' ' + parts.join(' ') : ''
    return {
      full: `import { Button } from "@/components/ui/button"\n\nexport function MyButton() {\n  return (\n    <Button${p}>\n      ${label}\n    </Button>\n  )\n}`,
      usage: `<Button${p}>${label}</Button>`,
    }
  }
  if (component === 'Badge') {
    const variant = (props.variant as string) ?? 'default'
    const label = (props.label as string) ?? 'Badge'
    const parts: string[] = []
    if (variant !== 'default') parts.push(`variant="${variant}"`)
    const p = parts.length ? ' ' + parts.join(' ') : ''
    return {
      full: `import { Badge } from "@/components/ui/badge"\n\nexport function MyBadge() {\n  return (\n    <Badge${p}>\n      ${label}\n    </Badge>\n  )\n}`,
      usage: `<Badge${p}>${label}</Badge>`,
    }
  }
  if (component === 'Input') {
    const placeholder = (props.placeholder as string) ?? 'Enter text...'
    const disabled = (props.disabled as boolean) ?? false
    const parts = [`placeholder="${placeholder}"`]
    if (disabled) parts.push('disabled')
    const p = ' ' + parts.join(' ')
    return {
      full: `import { Input } from "@/components/ui/input"\n\nexport function MyInput() {\n  return (\n    <Input${p} />\n  )\n}`,
      usage: `<Input${p} />`,
    }
  }
  if (component === 'Alert') {
    const variant = (props.variant as string) ?? 'default'
    const title = (props.title as string) ?? 'Heads up!'
    const description = (props.description as string) ?? 'You can add components to your app using the CLI.'
    const p = variant !== 'default' ? ` variant="${variant}"` : ''
    return {
      full: `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"\n\nexport function MyAlert() {\n  return (\n    <Alert${p}>\n      <AlertTitle>${title}</AlertTitle>\n      <AlertDescription>${description}</AlertDescription>\n    </Alert>\n  )\n}`,
      usage: `<Alert${p}><AlertTitle>${title}</AlertTitle><AlertDescription>${description}</AlertDescription></Alert>`,
    }
  }
  if (component === 'Textarea') {
    const placeholder = (props.placeholder as string) ?? 'Type your message here.'
    const disabled = (props.disabled as boolean) ?? false
    const parts = [`placeholder="${placeholder}"`]
    if (disabled) parts.push('disabled')
    const p = ' ' + parts.join(' ')
    return {
      full: `import { Textarea } from "@/components/ui/textarea"\n\nexport function MyTextarea() {\n  return (\n    <Textarea${p} />\n  )\n}`,
      usage: `<Textarea${p} />`,
    }
  }
  if (component === 'Progress') {
    const value = Number(props.value ?? 60)
    return {
      full: `import { Progress } from "@/components/ui/progress"\n\nexport function MyProgress() {\n  return (\n    <Progress value={${value}} className="w-[280px]" />\n  )\n}`,
      usage: `<Progress value={${value}} className="w-[280px]" />`,
    }
  }
  const kebab = component.toLowerCase().replace(/\s+/g, '-')
  const pascal = component.replace(/\s+/g, '')
  return {
    full: `import { ${pascal} } from "@/components/ui/${kebab}"\n\nexport function My${pascal}() {\n  return (\n    <${pascal} />\n  )\n}`,
    usage: `<${pascal} />`,
  }
}

// ─── Inspector primitives ─────────────────────────────────────────────────────

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors duration-100 border border-transparent',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/70',
      )}
    >
      {label}
    </button>
  )
}

function InspectorSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 border-b border-border/40 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform duration-150', !open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  )
}

function ColorControl({
  label,
  value,
  onChange,
  paletteColors,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  paletteColors: string[]
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <ColorPicker value={value} onChange={onChange} paletteColors={paletteColors} />
        <span className="text-xs font-mono text-muted-foreground truncate max-w-[80px]">{value}</span>
      </div>
    </div>
  )
}

function RadiusControl({
  label,
  value,
  globalValue,
  onChange,
  hideReset = false,
}: {
  label: string
  value: number | undefined
  globalValue: number
  onChange: (v: number | undefined) => void
  hideReset?: boolean
}) {
  const [unit, setUnit] = useState<'px' | 'rem'>('px')
  const displayValue = value !== undefined ? value : globalValue
  const displayInUnit = unit === 'px' ? displayValue : parseFloat((displayValue / 16).toFixed(3))

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          {!hideReset && value !== undefined && (
            <button
              onClick={() => onChange(undefined)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors mr-1"
            >
              ↩ Global
            </button>
          )}
          {(['px', 'rem'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={cn(
                'text-xs px-1.5 py-0.5 rounded cursor-pointer',
                unit === u ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <input
        type="number"
        min={0}
        max={unit === 'px' ? 64 : 4}
        step={unit === 'px' ? 1 : 0.125}
        value={displayInUnit}
        onChange={(e) => {
          const raw = parseFloat(e.target.value)
          if (isNaN(raw)) return
          const inPx = unit === 'px' ? raw : Math.round(raw * 16)
          onChange(inPx)
        }}
        className="w-full h-8 text-sm font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring"
      />
      {value === undefined && (
        <p className="text-xs text-muted-foreground/60 mt-1">Using global ({globalValue}px)</p>
      )}
    </div>
  )
}

function PaddingControl({
  value,
  onChange,
  label = 'Padding',
}: {
  value: PaddingValue
  onChange: (v: PaddingValue) => void
  label?: string
}) {
  const [linked, setLinked] = useState(true)

  const update = (side: keyof PaddingValue, raw: string) => {
    const n = Math.max(0, parseInt(raw) || 0)
    if (linked) {
      onChange({ top: n, right: n, bottom: n, left: n })
    } else {
      onChange({ ...value, [side]: n })
    }
  }

  const inputCls = cn(
    'w-12 h-7 text-xs font-mono text-center',
    'bg-muted border border-border rounded-md',
    'outline-none focus:border-ring',
    '[appearance:textfield]',
    '[&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:appearance-none',
  )

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <button
          onClick={() => setLinked(!linked)}
          className={cn(
            'text-xs px-2 py-0.5 rounded cursor-pointer transition-colors',
            linked ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/70',
          )}
        >
          {linked ? 'Linked' : 'Individual'}
        </button>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 w-3 text-center">T</span>
          <input type="number" min={0} max={64} value={value.top} onChange={(e) => update('top', e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/60 w-3 text-center">L</span>
            <input type="number" min={0} max={64} value={value.left} onChange={(e) => update('left', e.target.value)} className={inputCls} />
          </div>
          <div className="w-10 h-7 border-2 border-dashed border-border/50 rounded-md" />
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={64} value={value.right} onChange={(e) => update('right', e.target.value)} className={inputCls} />
            <span className="text-[10px] text-muted-foreground/60 w-3 text-center">R</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60 w-3 text-center">B</span>
          <input type="number" min={0} max={64} value={value.bottom} onChange={(e) => update('bottom', e.target.value)} className={inputCls} />
        </div>
      </div>
    </div>
  )
}

// ─── Global settings section ──────────────────────────────────────────────────

function GlobalSettingsSection({
  globalRadius,
  onChangeGlobalRadius,
}: {
  globalRadius: number
  onChangeGlobalRadius: (v: number) => void
}) {
  return (
    <InspectorSection title="Global Settings">
      <RadiusControl
        label="Global radius"
        value={globalRadius}
        globalValue={globalRadius}
        onChange={(v) => { if (v !== undefined) onChangeGlobalRadius(v) }}
        hideReset
      />
      <p className="text-xs text-muted-foreground px-4 pb-2">
        Applied to all components unless overridden below.
      </p>
    </InspectorSection>
  )
}

// ─── Per-component inspector sections ────────────────────────────────────────

function ButtonSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const size = (props.size as string) ?? 'default'
  const shadow = (props.shadow as string) ?? 'none'
  const fontWeight = (props.fontWeight as string) ?? '500'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'sm', 'lg', 'icon'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Full width</span>
          <Switch
            checked={(props.fullWidth as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('fullWidth', v)}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Icons">
        <div className="px-4 pt-2 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Leading icon</span>
            <IconPicker
              value={(props.leadingIcon as string) ?? null}
              onChange={(v) => updateProp('leadingIcon', v ?? undefined)}
              placeholder="Add icon..."
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Trailing icon</span>
            <IconPicker
              value={(props.trailingIcon as string) ?? null}
              onChange={(v) => updateProp('trailingIcon', v ?? undefined)}
              placeholder="Add icon..."
            />
          </div>
          <p className="text-xs text-muted-foreground mb-1.5">Icon size</p>
          <div className="flex gap-1.5">
            {['12', '14', '16', '20'].map((s) => (
              <PillButton key={s} label={s} active={((props.iconSize as string) ?? '16') === s} onClick={() => updateProp('iconSize', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? primaryColor}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Text"
          value={(props.textColor as string) ?? '#ffffff'}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Border"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={(props.strokeWidth as number) ?? 1}
              onChange={(e) => updateProp('strokeWidth', parseFloat(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Button radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>

      <InspectorSection title="Typography">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Font size</span>
          <Input
            type="number"
            min={10}
            max={24}
            value={(props.fontSize as number) ?? 14}
            onChange={(e) => updateProp('fontSize', Number(e.target.value))}
            className="w-16 h-7 text-xs text-right"
          />
        </div>
        <div className="px-4 pt-1 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Font weight</p>
          <div className="flex flex-wrap gap-1.5">
            {[['400', 'normal'], ['500', 'medium'], ['600', 'semibold'], ['700', 'bold']].map(([val, label]) => (
              <PillButton key={val} label={label} active={fontWeight === val} onClick={() => updateProp('fontWeight', val)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? defaultPadding}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>

      <InspectorSection title="Shadow">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['none', 'sm', 'md', 'lg'].map((s) => (
            <PillButton key={s} label={s} active={shadow === s} onClick={() => updateProp('shadow', s)} />
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch
            checked={(props.disabled as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('disabled', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Loading</span>
          <Switch
            checked={(props.loading as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('loading', v)}
          />
        </div>
      </InspectorSection>
    </>
  )
}

function BadgeSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const fontWeight = (props.fontWeight as string) ?? '500'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'secondary', 'destructive', 'outline'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Label</p>
          <Input
            value={(props.label as string) ?? 'Badge'}
            onChange={(e) => updateProp('label', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Icons">
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <span className="text-xs text-muted-foreground">Leading icon</span>
          <IconPicker
            value={(props.leadingIcon as string) ?? null}
            onChange={(v) => updateProp('leadingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? primaryColor}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Text"
          value={(props.textColor as string) ?? '#ffffff'}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={(props.strokeWidth as number) ?? 1}
              onChange={(e) => updateProp('strokeWidth', parseFloat(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Badge radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>

      <InspectorSection title="Typography">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Font size</span>
          <Input
            type="number"
            min={10}
            max={20}
            value={(props.fontSize as number) ?? 12}
            onChange={(e) => updateProp('fontSize', Number(e.target.value))}
            className="w-16 h-7 text-xs text-right"
          />
        </div>
        <div className="px-4 pt-1 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Font weight</p>
          <div className="flex flex-wrap gap-1.5">
            {[['400', 'normal'], ['500', 'medium'], ['600', 'semibold'], ['700', 'bold']].map(([val, label]) => (
              <PillButton key={val} label={label} active={fontWeight === val} onClick={() => updateProp('fontWeight', val)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? { top: 2, right: 10, bottom: 2, left: 10 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
    </>
  )
}

function InputSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Placeholder</p>
          <Input
            value={(props.placeholder as string) ?? 'Enter text...'}
            onChange={(e) => updateProp('placeholder', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <ColorControl
          label="Border"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? primaryColor}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={(props.strokeWidth as number) ?? 1}
              onChange={(e) => updateProp('strokeWidth', parseFloat(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Input radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>

      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? { top: 4, right: 12, bottom: 4, left: 12 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>

      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch
            checked={(props.disabled as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('disabled', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Error state</span>
          <Switch
            checked={(props.errorState as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('errorState', v)}
          />
        </div>
        {(props.errorState as boolean) && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Error message</p>
            <Input
              value={(props.errorMessage as string) ?? 'This field is required.'}
              onChange={(e) => updateProp('errorMessage', e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        )}
      </InspectorSection>
    </>
  )
}

function CardSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const shadow = (props.shadow as string) ?? 'none'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input
            value={(props.title as string) ?? 'Card Title'}
            onChange={(e) => updateProp('title', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <Input
            value={(props.description as string) ?? 'Card description goes here.'}
            onChange={(e) => updateProp('description', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Content</p>
          <Input
            value={(props.content as string) ?? 'Card content area.'}
            onChange={(e) => updateProp('content', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? primaryColor}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Border"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={(props.strokeWidth as number) ?? 1}
              onChange={(e) => updateProp('strokeWidth', parseFloat(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Card radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>

      <InspectorSection title="Shadow">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['none', 'sm', 'md', 'lg'].map((s) => (
            <PillButton key={s} label={s} active={shadow === s} onClick={() => updateProp('shadow', s)} />
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? { top: 24, right: 24, bottom: 24, left: 24 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
    </>
  )
}

function AlertSections({ props, updateProp, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex gap-1.5">
            {['default', 'destructive'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input
            value={(props.title as string) ?? 'Heads up!'}
            onChange={(e) => updateProp('title', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <Input
            value={(props.description as string) ?? 'You can add components to your app using the CLI.'}
            onChange={(e) => updateProp('description', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>
    </>
  )
}

function AvatarSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const size = (props.size as string) ?? 'default'
  const shape = (props.shape as string) ?? 'circle'
  const contentType = (props.type as string) ?? 'initials'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex flex-wrap gap-1.5">
            {['sm', 'default', 'lg', 'xl'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Shape</p>
          <div className="flex gap-1.5">
            {['circle', 'square', 'rounded'].map((s) => (
              <PillButton key={s} label={s} active={shape === s} onClick={() => updateProp('shape', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Type</p>
          <div className="flex gap-1.5">
            {['initials', 'image', 'icon'].map((t) => (
              <PillButton key={t} label={t} active={contentType === t} onClick={() => updateProp('type', t)} />
            ))}
          </div>
        </div>
        {contentType === 'initials' && (
          <div className="px-4 pt-2 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Fallback text</p>
            <Input
              value={(props.fallback as string) ?? 'AB'}
              onChange={(e) => updateProp('fallback', e.target.value)}
              className="h-7 text-xs rounded-md"
              maxLength={2}
            />
          </div>
        )}
        {contentType === 'image' && (
          <div className="px-4 pt-2 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Image URL</p>
            <Input
              value={(props.imageUrl as string) ?? 'https://github.com/shadcn.png'}
              onChange={(e) => updateProp('imageUrl', e.target.value)}
              className="h-7 text-xs rounded-md"
              placeholder="https://..."
            />
          </div>
        )}
        {contentType === 'icon' && (
          <div className="flex items-center justify-between px-4 pt-2 pb-2">
            <span className="text-xs text-muted-foreground">Fallback icon</span>
            <IconPicker
              value={(props.fallbackIcon as string) ?? 'User'}
              onChange={(v) => updateProp('fallbackIcon', v ?? undefined)}
              placeholder="Pick icon..."
            />
          </div>
        )}
      </InspectorSection>

      <InspectorSection title="Colors">
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? primaryColor}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Text"
          value={(props.textColor as string) ?? '#ffffff'}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>

      <InspectorSection title="Border">
        <ColorControl
          label="Border color"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={(props.strokeWidth as number) ?? 0}
              onChange={(e) => updateProp('strokeWidth', parseFloat(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Avatar radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

function SwitchSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Checked</span>
          <Switch
            checked={(props.checked as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('checked', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch
            checked={(props.disabled as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('disabled', v)}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Track (active)"
          value={(props.switchTrackColor as string) ?? primaryColor}
          onChange={(v) => updateProp('switchTrackColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
    </>
  )
}

function SheetSections({ props, updateProp, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const side = (props.side as string) ?? 'right'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Side</p>
          <div className="flex flex-wrap gap-1.5">
            {['right', 'left', 'top', 'bottom'].map((s) => (
              <PillButton key={s} label={s} active={side === s} onClick={() => updateProp('side', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input
            value={(props.title as string) ?? 'Sheet Title'}
            onChange={(e) => updateProp('title', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Content</p>
          <Input
            value={(props.content as string) ?? 'Sheet content goes here.'}
            onChange={(e) => updateProp('content', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>
    </>
  )
}

function CalendarSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'single'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Variant">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['single', 'range', 'inline', 'mini'].map((v) => (
            <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show outside days</span>
          <Switch
            checked={(props.showOutsideDays as boolean) ?? true}
            onCheckedChange={(v) => updateProp('showOutsideDays', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Fixed weeks</span>
          <Switch
            checked={(props.fixedWeeks as boolean) ?? false}
            onCheckedChange={(v) => updateProp('fixedWeeks', v)}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Selected day"
          value={(props.selectedColor as string) ?? primaryColor}
          onChange={(v) => updateProp('selectedColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Today"
          value={(props.todayColor as string) ?? (paletteColors[1] ?? '#94a3b8')}
          onChange={(v) => updateProp('todayColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Calendar radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? { top: 12, right: 12, bottom: 12, left: 12 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
    </>
  )
}

function TabsSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const tabCount = (props.tabCount as number) ?? 3
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Variant">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['default', 'underline', 'pill', 'bordered'].map((v) => (
            <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Tab count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4].map((n) => (
              <PillButton key={n} label={String(n)} active={tabCount === n} onClick={() => updateProp('tabCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: tabCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Tab {i + 1} label</p>
            <Input
              value={(props[`tab${i}Label`] as string) ?? `Tab ${i + 1}`}
              onChange={(e) => updateProp(`tab${i}Label`, e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        ))}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Active tab"
          value={(props.activeColor as string) ?? primaryColor}
          onChange={(v) => updateProp('activeColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl
          label="List radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

function TableSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Variant">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['default', 'striped', 'borderless', 'compact'].map((v) => (
            <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Columns</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={((props.colCount as number) ?? 3) === n} onClick={() => updateProp('colCount', n)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Rows</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={((props.rowCount as number) ?? 2) === n} onClick={() => updateProp('rowCount', n)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show header</span>
          <Switch
            checked={(props.showHeader as boolean) ?? true}
            onCheckedChange={(v) => updateProp('showHeader', v)}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Header background"
          value={(props.headerBg as string) ?? (paletteColors[0] ?? '#f9fafb')}
          onChange={(v) => updateProp('headerBg', v)}
          paletteColors={paletteColors}
        />
        {variant === 'striped' && (
          <ColorControl
            label="Stripe color"
            value={(props.stripeColor as string) ?? '#f9fafb'}
            onChange={(v) => updateProp('stripeColor', v)}
            paletteColors={paletteColors}
          />
        )}
        <ColorControl
          label="Border color"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
    </>
  )
}

function TextareaSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const resize = (props.resize as string) ?? 'vertical'
  const fontWeight = (props.fontWeight as string) ?? '400'
  const fontSize = (props.fontSize as number) ?? 14
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Resize</p>
          <div className="flex flex-wrap gap-1.5">
            {['none', 'vertical', 'horizontal', 'both'].map((r) => (
              <PillButton key={r} label={r} active={resize === r} onClick={() => updateProp('resize', r)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Input
            type="number"
            min={2}
            max={12}
            value={(props.rows as number) ?? 4}
            onChange={(e) => updateProp('rows', Number(e.target.value))}
            className="w-16 h-7 text-xs text-right"
          />
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Placeholder</p>
          <Input
            value={(props.placeholder as string) ?? 'Type your message here.'}
            onChange={(e) => updateProp('placeholder', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Background"
          value={(props.bgColor as string) ?? '#ffffff'}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Border"
          value={(props.borderColor as string) ?? (paletteColors[1] ?? '#e5e7eb')}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Text"
          value={(props.textColor as string) ?? '#000000'}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Textarea radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
      <InspectorSection title="Spacing">
        <PaddingControl
          value={(props.padding as PaddingValue) ?? { top: 8, right: 12, bottom: 8, left: 12 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
      <InspectorSection title="Typography">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Font size</span>
          <div className="flex gap-1.5">
            {[12, 13, 14, 16].map((s) => (
              <PillButton key={s} label={String(s)} active={fontSize === s} onClick={() => updateProp('fontSize', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-1 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Font weight</p>
          <div className="flex flex-wrap gap-1.5">
            {[['400', 'normal'], ['500', 'medium'], ['600', 'semibold']].map(([val, label]) => (
              <PillButton key={val} label={label} active={fontWeight === val} onClick={() => updateProp('fontWeight', val)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch
            checked={(props.disabled as boolean) ?? false}
            onCheckedChange={(v) => updateProp('disabled', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Read only</span>
          <Switch
            checked={(props.readOnly as boolean) ?? false}
            onCheckedChange={(v) => updateProp('readOnly', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Error state</span>
          <Switch
            checked={(props.errorState as boolean) ?? false}
            onCheckedChange={(v) => updateProp('errorState', v)}
          />
        </div>
        {(props.errorState as boolean) && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Error message</p>
            <Input
              value={(props.errorMessage as string) ?? 'This field is required.'}
              onChange={(e) => updateProp('errorMessage', e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        )}
      </InspectorSection>
    </>
  )
}

function CheckboxSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const size = (props.size as string) ?? 'default'
  const shape = (props.shape as string) ?? 'square'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'default', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Shape</p>
          <div className="flex gap-1.5">
            {['square', 'circle'].map((s) => (
              <PillButton key={s} label={s} active={shape === s} onClick={() => updateProp('shape', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Label</p>
          <Input
            value={(props.label as string) ?? 'Accept terms and conditions'}
            onChange={(e) => updateProp('label', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <Input
            value={(props.description as string) ?? ''}
            onChange={(e) => updateProp('description', e.target.value)}
            className="h-7 text-xs rounded-md"
            placeholder="Optional description..."
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl
          label="Checked color"
          value={(props.checkedColor as string) ?? primaryColor}
          onChange={(v) => updateProp('checkedColor', v)}
          paletteColors={paletteColors}
        />
        <ColorControl
          label="Label color"
          value={(props.labelColor as string) ?? ''}
          onChange={(v) => updateProp('labelColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Checked</span>
          <Switch checked={(props.checked as boolean) ?? false} onCheckedChange={(v) => updateProp('checked', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Indeterminate</span>
          <Switch checked={(props.indeterminate as boolean) ?? false} onCheckedChange={(v) => updateProp('indeterminate', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function DialogSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const size = (props.size as string) ?? 'default'
  const position = (props.position as string) ?? 'center'
  const confirmVariant = (props.confirmVariant as string) ?? 'default'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex flex-wrap gap-1.5">
            {['sm', 'default', 'lg', 'full'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Position</p>
          <div className="flex gap-1.5">
            {['center', 'top'].map((p) => (
              <PillButton key={p} label={p} active={position === p} onClick={() => updateProp('position', p)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input value={(props.title as string) ?? 'Dialog Title'} onChange={(e) => updateProp('title', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <Input value={(props.description as string) ?? 'Dialog description here.'} onChange={(e) => updateProp('description', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show footer</span>
          <Switch checked={(props.showFooter as boolean) ?? true} onCheckedChange={(v) => updateProp('showFooter', v)} />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Confirm label</p>
          <Input value={(props.confirmLabel as string) ?? 'Confirm'} onChange={(e) => updateProp('confirmLabel', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Cancel label</p>
          <Input value={(props.cancelLabel as string) ?? 'Cancel'} onChange={(e) => updateProp('cancelLabel', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Confirm variant</p>
          <div className="flex gap-1.5">
            {['default', 'destructive'].map((v) => (
              <PillButton key={v} label={v} active={confirmVariant === v} onClick={() => updateProp('confirmVariant', v)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Header background" value={(props.headerBg as string) ?? ''} onChange={(v) => updateProp('headerBg', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Dialog radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function DropdownMenuSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const itemCount = (props.itemCount as number) ?? 3
  const showIcons = (props.showIcons as boolean) ?? false
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Side</p>
          <div className="flex flex-wrap gap-1.5">
            {['bottom', 'top', 'left', 'right'].map((s) => (
              <PillButton key={s} label={s} active={((props.side as string) ?? 'bottom') === s} onClick={() => updateProp('side', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Align</p>
          <div className="flex gap-1.5">
            {['start', 'center', 'end'].map((a) => (
              <PillButton key={a} label={a} active={((props.align as string) ?? 'start') === a} onClick={() => updateProp('align', a)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Item count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={itemCount === n} onClick={() => updateProp('itemCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: itemCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Item {i + 1} label</p>
            <Input
              value={(props[`item${i}Label`] as string) ?? `Item ${i + 1}`}
              onChange={(e) => updateProp(`item${i}Label`, e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show separator</span>
          <Switch checked={(props.showSeparator as boolean) ?? false} onCheckedChange={(v) => updateProp('showSeparator', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show icons</span>
          <Switch checked={showIcons} onCheckedChange={(v) => updateProp('showIcons', v)} />
        </div>
        {showIcons && Array.from({ length: itemCount }, (_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-1">
            <span className="text-xs text-muted-foreground">Item {i + 1} icon</span>
            <IconPicker value={(props[`item${i}Icon`] as string) ?? null} onChange={(v) => updateProp(`item${i}Icon`, v ?? undefined)} placeholder="Pick icon..." />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show shortcuts</span>
          <Switch checked={(props.showShortcuts as boolean) ?? false} onCheckedChange={(v) => updateProp('showShortcuts', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Text color" value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Menu radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function LabelSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const fontWeight = (props.fontWeight as string) ?? 'medium'
  const letterSpacing = (props.letterSpacing as string) ?? 'normal'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Typography">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Text</p>
          <Input value={(props.text as string) ?? 'Form label'} onChange={(e) => updateProp('text', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Font size</p>
          <div className="flex flex-wrap gap-1.5">
            {[11, 12, 13, 14, 16].map((s) => (
              <PillButton key={s} label={String(s)} active={((props.fontSize as number) ?? 14) === s} onClick={() => updateProp('fontSize', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Font weight</p>
          <div className="flex flex-wrap gap-1.5">
            {['normal', 'medium', 'semibold', 'bold'].map((w) => (
              <PillButton key={w} label={w} active={fontWeight === w} onClick={() => updateProp('fontWeight', w)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Letter spacing</p>
          <div className="flex gap-1.5">
            {['tight', 'normal', 'wide'].map((s) => (
              <PillButton key={s} label={s} active={letterSpacing === s} onClick={() => updateProp('letterSpacing', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Text color" value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Required</span>
          <Switch checked={(props.required as boolean) ?? false} onCheckedChange={(v) => updateProp('required', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function PopoverSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Side</p>
          <div className="flex flex-wrap gap-1.5">
            {['bottom', 'top', 'left', 'right'].map((s) => (
              <PillButton key={s} label={s} active={((props.side as string) ?? 'bottom') === s} onClick={() => updateProp('side', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Align</p>
          <div className="flex gap-1.5">
            {['start', 'center', 'end'].map((a) => (
              <PillButton key={a} label={a} active={((props.align as string) ?? 'center') === a} onClick={() => updateProp('align', a)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Width (px)</span>
          <Input type="number" min={100} max={600} value={(props.width as number) ?? 256} onChange={(e) => updateProp('width', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input value={(props.title as string) ?? ''} onChange={(e) => updateProp('title', e.target.value)} className="h-7 text-xs rounded-md" placeholder="Optional title..." />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Body text</p>
          <Input value={(props.content as string) ?? 'Popover content goes here.'} onChange={(e) => updateProp('content', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Border color" value={(props.borderColor as string) ?? ''} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Popover radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function ProgressSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const progressSize = (props.size as string) ?? 'default'
  const progressStyle = (props.style as string) ?? 'default'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Value</span>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} value={(props.value as number) ?? 60} onChange={(e) => updateProp('value', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
            <span className="text-xs text-muted-foreground w-8">{(props.value as number) ?? 60}%</span>
          </div>
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'default', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={progressSize === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Style</p>
          <div className="flex gap-1.5">
            {['default', 'striped', 'indeterminate'].map((s) => (
              <PillButton key={s} label={s} active={progressStyle === s} onClick={() => updateProp('style', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Track color" value={(props.trackColor as string) ?? ''} onChange={(v) => updateProp('trackColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Indicator color" value={(props.indicatorColor as string) ?? primaryColor} onChange={(v) => updateProp('indicatorColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Progress radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function RadioGroupSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const orientation = (props.orientation as string) ?? 'vertical'
  const optionCount = (props.optionCount as number) ?? 3
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Orientation</p>
          <div className="flex gap-1.5">
            {['vertical', 'horizontal'].map((o) => (
              <PillButton key={o} label={o} active={orientation === o} onClick={() => updateProp('orientation', o)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Option count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4].map((n) => (
              <PillButton key={n} label={String(n)} active={optionCount === n} onClick={() => updateProp('optionCount', n)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        {Array.from({ length: optionCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Option {i + 1} label</p>
            <Input
              value={(props[`option${i + 1}Label`] as string) ?? `Option ${i + 1}`}
              onChange={(e) => updateProp(`option${i + 1}Label`, e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        ))}
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Default selected</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: optionCount }, (_, i) => (
              <PillButton
                key={i}
                label={String(i + 1)}
                active={((props.defaultValue as string) ?? 'option1') === `option${i + 1}`}
                onClick={() => updateProp('defaultValue', `option${i + 1}`)}
              />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Selected color" value={(props.selectedColor as string) ?? primaryColor} onChange={(v) => updateProp('selectedColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Label color" value={(props.labelColor as string) ?? ''} onChange={(v) => updateProp('labelColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function SelectSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const selectSize = (props.size as string) ?? 'default'
  const optionCount = (props.optionCount as number) ?? 3
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Width (px)</span>
          <Input type="number" min={100} max={500} value={(props.width as number) ?? 200} onChange={(e) => updateProp('width', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'default', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={selectSize === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Placeholder</p>
          <Input value={(props.placeholder as string) ?? 'Select option'} onChange={(e) => updateProp('placeholder', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Option count</p>
          <div className="flex flex-wrap gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={optionCount === n} onClick={() => updateProp('optionCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: optionCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Option {i + 1} label</p>
            <Input
              value={(props[`option${i + 1}Label`] as string) ?? `Option ${i + 1}`}
              onChange={(e) => updateProp(`option${i + 1}Label`, e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        ))}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Border color" value={(props.borderColor as string) ?? ''} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Text color" value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Select radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function SeparatorSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const orientation = (props.orientation as string) ?? 'horizontal'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Orientation</p>
          <div className="flex gap-1.5">
            {['horizontal', 'vertical'].map((o) => (
              <PillButton key={o} label={o} active={orientation === o} onClick={() => updateProp('orientation', o)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Thickness (px)</span>
          <Input type="number" min={1} max={16} value={(props.thickness as number) ?? 1} onChange={(e) => updateProp('thickness', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Color" value={(props.color as string) ?? ''} onChange={(v) => updateProp('color', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Spacing">
        <PaddingControl
          label="Spacing"
          value={(props.margin as PaddingValue) ?? { top: 16, right: 0, bottom: 16, left: 0 }}
          onChange={(v) => updateProp('margin', v)}
        />
      </InspectorSection>
    </>
  )
}

function SkeletonSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const preset = (props.preset as string) ?? 'text-lines'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Preset</p>
          <div className="flex flex-wrap gap-1.5">
            {['text-lines', 'card', 'avatar-row', 'form', 'custom'].map((p) => (
              <PillButton key={p} label={p} active={preset === p} onClick={() => updateProp('preset', p)} />
            ))}
          </div>
        </div>
        {preset === 'custom' && (
          <>
            <div className="px-4 pt-2 pb-1">
              <p className="text-xs text-muted-foreground mb-1.5">Line count</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <PillButton key={n} label={String(n)} active={((props.lineCount as number) ?? 3) === n} onClick={() => updateProp('lineCount', n)} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-muted-foreground">Line height (px)</span>
              <Input type="number" min={8} max={48} value={(props.lineHeight as number) ?? 16} onChange={(e) => updateProp('lineHeight', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
            </div>
            <div className="px-4 pt-2 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">Line width</p>
              <div className="flex flex-wrap gap-1.5">
                {['full', '3/4', '1/2', 'random'].map((w) => (
                  <PillButton key={w} label={w} active={((props.lineWidth as string) ?? 'full') === w} onClick={() => updateProp('lineWidth', w)} />
                ))}
              </div>
            </div>
          </>
        )}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Base color" value={(props.baseColor as string) ?? ''} onChange={(v) => updateProp('baseColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Skeleton radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function SliderSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const orientation = (props.orientation as string) ?? 'horizontal'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Min</span>
          <Input type="number" value={(props.min as number) ?? 0} onChange={(e) => updateProp('min', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Max</span>
          <Input type="number" value={(props.max as number) ?? 100} onChange={(e) => updateProp('max', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Step</span>
          <Input type="number" min={0.01} value={(props.step as number) ?? 1} onChange={(e) => updateProp('step', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Value</span>
          <Input type="number" value={(props.value as number) ?? 50} onChange={(e) => updateProp('value', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Orientation</p>
          <div className="flex gap-1.5">
            {['horizontal', 'vertical'].map((o) => (
              <PillButton key={o} label={o} active={orientation === o} onClick={() => updateProp('orientation', o)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show value label</span>
          <Switch checked={(props.showLabel as boolean) ?? false} onCheckedChange={(v) => updateProp('showLabel', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Track color" value={(props.trackColor as string) ?? ''} onChange={(v) => updateProp('trackColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Range color" value={(props.rangeColor as string) ?? primaryColor} onChange={(v) => updateProp('rangeColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Thumb color" value={(props.thumbColor as string) ?? ''} onChange={(v) => updateProp('thumbColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function ToggleSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const toggleSize = (props.size as string) ?? 'default'
  const iconPosition = (props.iconPosition as string) ?? 'leading'
  const showIcon = (props.showIcon as boolean) ?? false
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex gap-1.5">
            {['default', 'outline'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'default', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={toggleSize === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Pressed</span>
          <Switch checked={(props.pressed as boolean) ?? false} onCheckedChange={(v) => updateProp('pressed', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Label</p>
          <Input value={(props.label as string) ?? 'Toggle'} onChange={(e) => updateProp('label', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show icon</span>
          <Switch checked={showIcon} onCheckedChange={(v) => updateProp('showIcon', v)} />
        </div>
        {showIcon && (
          <>
            <div className="flex items-center justify-between px-4 py-1">
              <span className="text-xs text-muted-foreground">Icon</span>
              <IconPicker value={(props.icon as string) ?? null} onChange={(v) => updateProp('icon', v ?? undefined)} placeholder="Pick icon..." />
            </div>
            <div className="px-4 pt-2 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">Icon position</p>
              <div className="flex gap-1.5">
                {['leading', 'trailing', 'only'].map((p) => (
                  <PillButton key={p} label={p} active={iconPosition === p} onClick={() => updateProp('iconPosition', p)} />
                ))}
              </div>
            </div>
          </>
        )}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Active background" value={(props.activeColor as string) ?? primaryColor} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Active text" value={(props.activeTextColor as string) ?? ''} onChange={(v) => updateProp('activeTextColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Inactive background" value={(props.inactiveColor as string) ?? ''} onChange={(v) => updateProp('inactiveColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
      </InspectorSection>
    </>
  )
}

function TooltipSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Side</p>
          <div className="flex flex-wrap gap-1.5">
            {['top', 'right', 'bottom', 'left'].map((s) => (
              <PillButton key={s} label={s} active={((props.side as string) ?? 'top') === s} onClick={() => updateProp('side', s)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Delay (ms)</span>
          <Input type="number" min={0} max={2000} step={50} value={(props.delayDuration as number) ?? 200} onChange={(e) => updateProp('delayDuration', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Arrow</span>
          <Switch checked={(props.arrow as boolean) ?? false} onCheckedChange={(v) => updateProp('arrow', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Trigger label</p>
          <Input value={(props.triggerLabel as string) ?? 'Hover me'} onChange={(e) => updateProp('triggerLabel', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Tooltip text</p>
          <Input value={(props.content as string) ?? 'Tooltip content'} onChange={(e) => updateProp('content', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Text color" value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Tooltip radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function BreadcrumbSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const itemCount = (props.itemCount as number) ?? 3
  const sepStyle = (props.separatorStyle as string) ?? 'slash'
  const fontSize = (props.fontSize as number) ?? 14
  const fontWeight = (props.fontWeight as string) ?? 'medium'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Separator style</p>
          <div className="flex flex-wrap gap-1.5">
            {['slash', 'chevron', 'dot', 'arrow'].map((s) => (
              <PillButton key={s} label={s} active={sepStyle === s} onClick={() => updateProp('separatorStyle', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Item count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={itemCount === n} onClick={() => updateProp('itemCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: itemCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Item {i + 1} label</p>
            <Input
              value={(props[`item${i}Label`] as string) ?? (['Home', 'Projects', 'Current Page', 'Details', 'Edit'][i] ?? `Item ${i + 1}`)}
              onChange={(e) => updateProp(`item${i}Label`, e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Max visible</span>
          <Input type="number" min={2} max={10} value={(props.maxVisible as number) ?? 99} onChange={(e) => updateProp('maxVisible', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
      </InspectorSection>
      <InspectorSection title="Typography">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Font size</p>
          <div className="flex gap-1.5">
            {[12, 13, 14, 16].map((s) => (
              <PillButton key={s} label={String(s)} active={fontSize === s} onClick={() => updateProp('fontSize', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Font weight (active)</p>
          <div className="flex gap-1.5">
            {['normal', 'medium', 'semibold'].map((w) => (
              <PillButton key={w} label={w} active={fontWeight === w} onClick={() => updateProp('fontWeight', w)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Link color" value={(props.linkColor as string) ?? primaryColor} onChange={(v) => updateProp('linkColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Active page color" value={(props.activeColor as string) ?? ''} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Separator color" value={(props.separatorColor as string) ?? ''} onChange={(v) => updateProp('separatorColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Container radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function ButtonGroupSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const buttonCount = (props.buttonCount as number) ?? 3
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Button count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={buttonCount === n} onClick={() => updateProp('buttonCount', n)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Icon only</span>
          <Switch checked={(props.iconOnly as boolean) ?? false} onCheckedChange={(v) => updateProp('iconOnly', v)} />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'default', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={((props.size as string) ?? 'default') === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        {Array.from({ length: buttonCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Button {i + 1}</p>
            <Input
              value={(props[`btn${i}Label`] as string) ?? `Option ${i + 1}`}
              onChange={(e) => updateProp(`btn${i}Label`, e.target.value)}
              className="h-7 text-xs rounded-md mb-1.5"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Icon</span>
              <IconPicker
                value={(props[`btn${i}Icon`] as string) ?? null}
                onChange={(v) => updateProp(`btn${i}Icon`, v ?? undefined)}
                placeholder="Add icon..."
              />
            </div>
          </div>
        ))}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Active background" value={(props.activeColor as string) ?? primaryColor} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Active text" value={(props.activeTextColor as string) ?? ''} onChange={(v) => updateProp('activeTextColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Inactive background" value={(props.inactiveColor as string) ?? ''} onChange={(v) => updateProp('inactiveColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Border color" value={(props.borderColor as string) ?? ''} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Group radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function SidebarComponentSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const itemCount = (props.itemCount as number) ?? 4
  const sidebarStyle = (props.style as string) ?? 'default'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Width (px)</span>
          <Input type="number" min={48} max={400} value={(props.width as number) ?? 220} onChange={(e) => updateProp('width', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Collapsed</span>
          <Switch checked={(props.collapsed as boolean) ?? false} onCheckedChange={(v) => updateProp('collapsed', v)} />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Style</p>
          <div className="flex gap-1.5">
            {['default', 'floating', 'inset'].map((s) => (
              <PillButton key={s} label={s} active={sidebarStyle === s} onClick={() => updateProp('style', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">App name</p>
          <Input value={(props.appName as string) ?? 'Blox'} onChange={(e) => updateProp('appName', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Item count</p>
          <div className="flex gap-1.5">
            {[3, 4, 5, 6].map((n) => (
              <PillButton key={n} label={String(n)} active={itemCount === n} onClick={() => updateProp('itemCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: itemCount }, (_, i) => (
          <div key={i} className="px-4 pt-2 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Item {i + 1}</p>
            <Input
              value={(props[`item${i}Label`] as string) ?? (['Dashboard', 'Projects', 'Components', 'Settings', 'Analytics', 'Help'][i] ?? `Item ${i + 1}`)}
              onChange={(e) => updateProp(`item${i}Label`, e.target.value)}
              className="h-7 text-xs rounded-md mb-1.5"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Icon</span>
              <IconPicker
                value={(props[`item${i}Icon`] as string) ?? null}
                onChange={(v) => updateProp(`item${i}Icon`, v ?? undefined)}
                placeholder="Add icon..."
              />
            </div>
          </div>
        ))}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Active item color" value={(props.activeColor as string) ?? primaryColor} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Border color" value={(props.borderColor as string) ?? ''} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Text color" value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl label="Item radius" value={props.borderRadius as number | undefined} globalValue={globalRadius} onChange={(v) => updateProp('borderRadius', v)} />
      </InspectorSection>
    </>
  )
}

function BarChartSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const showSecondSeries = (props.showSecondSeries as boolean) ?? false
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Layout</p>
          <div className="flex gap-1.5">
            {['vertical', 'horizontal'].map((l) => (
              <PillButton key={l} label={l} active={((props.layout as string) ?? 'vertical') === l} onClick={() => updateProp('layout', l)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Bar radius</span>
          <Input type="number" min={0} max={20} value={(props.barRadius as number) ?? 4} onChange={(e) => updateProp('barRadius', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show grid</span>
          <Switch checked={(props.showGrid as boolean) ?? false} onCheckedChange={(v) => updateProp('showGrid', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show tooltip</span>
          <Switch checked={(props.showTooltip as boolean) ?? true} onCheckedChange={(v) => updateProp('showTooltip', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show legend</span>
          <Switch checked={(props.showLegend as boolean) ?? false} onCheckedChange={(v) => updateProp('showLegend', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show second series</span>
          <Switch checked={showSecondSeries} onCheckedChange={(v) => updateProp('showSecondSeries', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Series">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Series 1 label</p>
          <Input value={(props.series1Label as string) ?? 'Series 1'} onChange={(e) => updateProp('series1Label', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        {showSecondSeries && (
          <div className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Series 2 label</p>
            <Input value={(props.series2Label as string) ?? 'Series 2'} onChange={(e) => updateProp('series2Label', e.target.value)} className="h-7 text-xs rounded-md" />
          </div>
        )}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Bar color" value={(props.barColor as string) ?? primaryColor} onChange={(v) => updateProp('barColor', v)} paletteColors={paletteColors} />
        {showSecondSeries && (
          <ColorControl label="Bar 2 color" value={(props.bar2Color as string) ?? ''} onChange={(v) => updateProp('bar2Color', v)} paletteColors={paletteColors} />
        )}
        <ColorControl label="Grid color" value={(props.gridColor as string) ?? ''} onChange={(v) => updateProp('gridColor', v)} paletteColors={paletteColors} />
        <ColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
    </>
  )
}

function LineChartSections({ props, updateProp, paletteColors, primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const showSecondSeries = (props.showSecondSeries as boolean) ?? false
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Appearance">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Filled</span>
          <Switch checked={(props.filled as boolean) ?? false} onCheckedChange={(v) => updateProp('filled', v)} />
        </div>
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Curve</p>
          <div className="flex flex-wrap gap-1.5">
            {['monotone', 'linear', 'step', 'natural'].map((c) => (
              <PillButton key={c} label={c} active={((props.curve as string) ?? 'monotone') === c} onClick={() => updateProp('curve', c)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Stroke width</span>
          <Input type="number" min={1} max={4} value={(props.strokeWidth as number) ?? 2} onChange={(e) => updateProp('strokeWidth', Number(e.target.value))} className="w-16 h-7 text-xs text-right" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show dots</span>
          <Switch checked={(props.showDots as boolean) ?? false} onCheckedChange={(v) => updateProp('showDots', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show grid</span>
          <Switch checked={(props.showGrid as boolean) ?? false} onCheckedChange={(v) => updateProp('showGrid', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show tooltip</span>
          <Switch checked={(props.showTooltip as boolean) ?? true} onCheckedChange={(v) => updateProp('showTooltip', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show legend</span>
          <Switch checked={(props.showLegend as boolean) ?? false} onCheckedChange={(v) => updateProp('showLegend', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show second series</span>
          <Switch checked={showSecondSeries} onCheckedChange={(v) => updateProp('showSecondSeries', v)} />
        </div>
      </InspectorSection>
      <InspectorSection title="Series">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Series 1 label</p>
          <Input value={(props.series1Label as string) ?? 'Series 1'} onChange={(e) => updateProp('series1Label', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        {showSecondSeries && (
          <div className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground mb-1.5">Series 2 label</p>
            <Input value={(props.series2Label as string) ?? 'Series 2'} onChange={(e) => updateProp('series2Label', e.target.value)} className="h-7 text-xs rounded-md" />
          </div>
        )}
      </InspectorSection>
      <InspectorSection title="Colors">
        <ColorControl label="Line color" value={(props.lineColor as string) ?? primaryColor} onChange={(v) => updateProp('lineColor', v)} paletteColors={paletteColors} />
        {showSecondSeries && (
          <ColorControl label="Line 2 color" value={(props.line2Color as string) ?? ''} onChange={(v) => updateProp('line2Color', v)} paletteColors={paletteColors} />
        )}
        <ColorControl label="Grid color" value={(props.gridColor as string) ?? ''} onChange={(v) => updateProp('gridColor', v)} paletteColors={paletteColors} />
      </InspectorSection>
    </>
  )
}

// ─── Inspector router ─────────────────────────────────────────────────────────

function Inspector({
  component,
  ...shared
}: { component: string } & InspectorSharedProps) {
  if (component === 'Button') return <ButtonSections {...shared} />
  if (component === 'Badge') return <BadgeSections {...shared} />
  if (component === 'Input') return <InputSections {...shared} />
  if (component === 'Card') return <CardSections {...shared} />
  if (component === 'Alert') return <AlertSections {...shared} />
  if (component === 'Avatar') return <AvatarSections {...shared} />
  if (component === 'Switch') return <SwitchSections {...shared} />
  if (component === 'Sheet') return <SheetSections {...shared} />
  if (component === 'Calendar') return <CalendarSections {...shared} />
  if (component === 'Tabs') return <TabsSections {...shared} />
  if (component === 'Table') return <TableSections {...shared} />
  if (component === 'Textarea') return <TextareaSections {...shared} />
  if (component === 'Checkbox') return <CheckboxSections {...shared} />
  if (component === 'Dialog') return <DialogSections {...shared} />
  if (component === 'Dropdown Menu') return <DropdownMenuSections {...shared} />
  if (component === 'Label') return <LabelSections {...shared} />
  if (component === 'Popover') return <PopoverSections {...shared} />
  if (component === 'Progress') return <ProgressSections {...shared} />
  if (component === 'Radio Group') return <RadioGroupSections {...shared} />
  if (component === 'Select') return <SelectSections {...shared} />
  if (component === 'Separator') return <SeparatorSections {...shared} />
  if (component === 'Skeleton') return <SkeletonSections {...shared} />
  if (component === 'Slider') return <SliderSections {...shared} />
  if (component === 'Toggle') return <ToggleSections {...shared} />
  if (component === 'Tooltip') return <TooltipSections {...shared} />
  if (component === 'Bar Chart') return <BarChartSections {...shared} />
  if (component === 'Breadcrumb') return <BreadcrumbSections {...shared} />
  if (component === 'Button Group') return <ButtonGroupSections {...shared} />
  if (component === 'Line Chart') return <LineChartSections {...shared} />
  if (component === 'Sidebar') return <SidebarComponentSections {...shared} />

  return (
    <>
      <GlobalSettingsSection
        globalRadius={shared.globalRadius}
        onChangeGlobalRadius={shared.onChangeGlobalRadius}
      />
      <p className="text-sm text-muted-foreground px-4 pt-3">
        Deep inspector for {component} coming in the next update.
      </p>
    </>
  )
}

// ─── Sheet preview (needs own state) ─────────────────────────────────────────

function SheetPreview({ props }: { props: ComponentProps }) {
  const [open, setOpen] = useState(false)
  const side = (props.side as 'right' | 'left' | 'top' | 'bottom') ?? 'right'
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>Open Sheet</Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side}>
          <SheetHeader>
            <SheetTitle>{(props.title as string) ?? 'Sheet Title'}</SheetTitle>
            <SheetDescription>{(props.content as string) ?? 'Sheet content goes here.'}</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
      <p className="text-xs text-muted-foreground">Click button to preview</p>
    </div>
  )
}

function DialogPreview({ props, globalRadius }: { props: ComponentProps; globalRadius: number }) {
  const [open, setOpen] = useState(false)
  const sizeMap: Record<string, string> = { sm: 'max-w-sm', default: 'max-w-lg', lg: 'max-w-2xl', full: 'max-w-full' }
  const sizeClass = sizeMap[(props.size as string) ?? 'default'] ?? 'max-w-lg'
  const isTop = (props.position as string) === 'top'
  const radius = props.borderRadius !== undefined ? `${props.borderRadius}px` : `${globalRadius}px`
  const showFooter = (props.showFooter as boolean) ?? true
  const confirmVariant = ((props.confirmVariant as string) ?? 'default') as 'default' | 'destructive'
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>Open Dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(sizeClass, isTop && 'top-16 translate-y-0')}
          style={{ backgroundColor: (props.bgColor as string) || 'hsl(var(--background))', borderRadius: radius }}
        >
          <DialogHeader style={props.headerBg ? { backgroundColor: props.headerBg as string, margin: '-1.5rem -1.5rem 0', padding: '1.5rem', borderRadius: `${radius} ${radius} 0 0` } : {}}>
            <DialogTitle>{(props.title as string) ?? 'Dialog Title'}</DialogTitle>
            <DialogDescription>{(props.description as string) ?? 'Dialog description here.'}</DialogDescription>
          </DialogHeader>
          {showFooter && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{(props.cancelLabel as string) ?? 'Cancel'}</Button>
              <Button variant={confirmVariant} onClick={() => setOpen(false)}>{(props.confirmLabel as string) ?? 'Confirm'}</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">Click button to preview</p>
    </div>
  )
}

function PopoverPreview({ props, globalRadius }: { props: ComponentProps; globalRadius: number }) {
  const [open, setOpen] = useState(false)
  const side = ((props.side as string) ?? 'bottom') as 'top' | 'right' | 'bottom' | 'left'
  const align = ((props.align as string) ?? 'center') as 'start' | 'center' | 'end'
  const width = (props.width as number) ?? 256
  const radius = props.borderRadius !== undefined ? `${props.borderRadius}px` : `${globalRadius}px`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        style={{
          width: `${width}px`,
          backgroundColor: (props.bgColor as string) || 'hsl(var(--popover))',
          borderColor: (props.borderColor as string) || undefined,
          borderRadius: radius,
        }}
      >
        {(props.title as string) && <p className="font-medium text-sm mb-1">{props.title as string}</p>}
        <p className="text-sm text-muted-foreground">{(props.content as string) ?? 'Popover content goes here.'}</p>
      </PopoverContent>
    </Popover>
  )
}

// ─── Canvas previews ──────────────────────────────────────────────────────────

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
type AlertVariant = 'default' | 'destructive'

function ComponentPreview({
  name,
  props,
  updateProp,
  globalRadius,
}: {
  name: string
  props: ComponentProps
  updateProp: UpdateProp
  globalRadius: number
}) {
  const radius = `${(props.borderRadius as number) ?? globalRadius}px`

  if (name === 'Alert') {
    return (
      <Alert
        variant={(props.variant as AlertVariant) ?? 'default'}
        className="w-[380px]"
        style={{ borderRadius: radius }}
      >
        <AlertTitle>{(props.title as string) ?? 'Heads up!'}</AlertTitle>
        <AlertDescription>{(props.description as string) ?? 'You can add components to your app using the CLI.'}</AlertDescription>
      </Alert>
    )
  }

  if (name === 'Avatar') {
    const avSize = (props.size as string) ?? 'default'
    const avShape = (props.shape as string) ?? 'circle'
    const avType = (props.type as string) ?? 'initials'
    const sizeClass = ({ sm: 'h-8 w-8', default: 'h-10 w-10', lg: 'h-16 w-16', xl: 'h-24 w-24' } as Record<string, string>)[avSize] ?? 'h-10 w-10'
    const shapeClass = ({ circle: 'rounded-full', square: 'rounded-md', rounded: 'rounded-xl' } as Record<string, string>)[avShape] ?? 'rounded-full'
    const iconSize = ({ sm: 12, default: 16, lg: 24, xl: 36 } as Record<string, number>)[avSize] ?? 16
    const explicitRadius = props.borderRadius !== undefined ? `${props.borderRadius}px` : undefined
    const AvatarFallbackIcon = props.fallbackIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.fallbackIcon as string] ?? null
      : null
    const borderStyle: React.CSSProperties = props.strokeWidth && Number(props.strokeWidth) > 0
      ? { border: `${props.strokeWidth}px solid ${(props.borderColor as string) ?? '#e5e7eb'}` }
      : {}
    return (
      <Avatar className={cn(sizeClass, shapeClass)} style={{ ...borderStyle, borderRadius: explicitRadius }}>
        {avType === 'image' && (
          <AvatarImage src={(props.imageUrl as string) ?? 'https://github.com/shadcn.png'} alt="Avatar" />
        )}
        <AvatarFallback className={shapeClass} style={{ backgroundColor: (props.bgColor as string) ?? CSS_PRIMARY, color: (props.textColor as string) ?? CSS_PRIMARY_FG }}>
          {avType === 'icon' && AvatarFallbackIcon
            ? <AvatarFallbackIcon size={iconSize} />
            : ((props.fallback as string) ?? 'AB')
          }
        </AvatarFallback>
      </Avatar>
    )
  }

  if (name === 'Badge') {
    const badgePadding = props.padding as PaddingValue | undefined
    const BadgeLeadingIcon = props.leadingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.leadingIcon as string] ?? null
      : null
    return (
      <Badge
        variant={(props.variant as BadgeVariant) ?? 'default'}
        style={{
          backgroundColor: (props.bgColor as string) || 'hsl(var(--primary))',
          color: (props.textColor as string) || 'hsl(var(--primary-foreground))',
          borderRadius: radius,
          fontSize: props.fontSize ? `${props.fontSize}px` : undefined,
          fontWeight: props.fontWeight as string | undefined,
          paddingTop: badgePadding ? `${badgePadding.top}px` : undefined,
          paddingBottom: badgePadding ? `${badgePadding.bottom}px` : undefined,
          paddingLeft: badgePadding ? `${badgePadding.left}px` : undefined,
          paddingRight: badgePadding ? `${badgePadding.right}px` : undefined,
        }}
      >
        {BadgeLeadingIcon && <BadgeLeadingIcon size={12} className="shrink-0" />}
        {(props.label as string) ?? 'Badge'}
      </Badge>
    )
  }

  if (name === 'Button') {
    const padding = props.padding as PaddingValue | undefined
    const LeadingIcon = props.leadingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.leadingIcon as string] ?? null
      : null
    const TrailingIcon = props.trailingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.trailingIcon as string] ?? null
      : null
    const iconSize = parseInt((props.iconSize as string) ?? '16')
    return (
      <Button
        variant={(props.variant as ButtonVariant) ?? 'default'}
        size={(props.size as ButtonSize) ?? 'default'}
        disabled={(props.disabled as boolean) ?? false}
        className={props.fullWidth ? 'w-full' : ''}
        style={{
          backgroundColor: props.bgColor as string | undefined,
          color: props.textColor as string | undefined,
          borderColor: props.borderColor as string | undefined,
          borderRadius: radius,
          fontSize: props.fontSize ? `${props.fontSize}px` : undefined,
          fontWeight: props.fontWeight as string | undefined,
          paddingLeft: padding ? `${padding.left}px` : undefined,
          paddingRight: padding ? `${padding.right}px` : undefined,
          paddingTop: padding ? `${padding.top}px` : undefined,
          paddingBottom: padding ? `${padding.bottom}px` : undefined,
          boxShadow: shadowValue(props.shadow as string | undefined),
          borderWidth: props.strokeWidth ? `${props.strokeWidth}px` : undefined,
        }}
      >
        {(props.loading as boolean) ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            {LeadingIcon && <LeadingIcon size={iconSize} />}
            {(props.size as string) !== 'icon' && ((props.label as string) ?? 'Button')}
            {TrailingIcon && <TrailingIcon size={iconSize} />}
          </>
        )}
      </Button>
    )
  }

  if (name === 'Calendar') {
    const calVariant = (props.variant as string) ?? 'single'
    const calPadding = props.padding as PaddingValue | undefined
    const showOutsideDays = (props.showOutsideDays as boolean) ?? true
    const fixedWeeks = (props.fixedWeeks as boolean) ?? false
    const calStyle: React.CSSProperties = {
      borderRadius: radius,
      paddingTop: calPadding ? `${calPadding.top}px` : undefined,
      paddingBottom: calPadding ? `${calPadding.bottom}px` : undefined,
      paddingLeft: calPadding ? `${calPadding.left}px` : undefined,
      paddingRight: calPadding ? `${calPadding.right}px` : undefined,
    }
    const calWrapperClass = cn(
      'rounded-md border border-border',
      calVariant === 'inline' && '!border-0 !rounded-none',
      calVariant === 'mini' && 'scale-75 origin-top-left',
    )
    const calendarProps = { showOutsideDays, fixedWeeks }
    return (
      <div style={calStyle} className={calWrapperClass}>
        {calVariant === 'range'
          ? <Calendar mode="range" numberOfMonths={2} {...calendarProps} />
          : <Calendar mode="single" {...calendarProps} />
        }
      </div>
    )
  }

  if (name === 'Card') {
    const cardPadding = props.padding as PaddingValue | undefined
    return (
      <Card
        className="w-[320px]"
        style={{
          backgroundColor: (props.bgColor as string) ?? 'hsl(var(--card))',
          borderColor: (props.borderColor as string) ?? 'hsl(var(--border))',
          borderRadius: radius,
          boxShadow: shadowValue(props.shadow as string | undefined),
          borderWidth: props.strokeWidth ? `${props.strokeWidth}px` : undefined,
          paddingTop: cardPadding ? `${cardPadding.top}px` : undefined,
          paddingBottom: cardPadding ? `${cardPadding.bottom}px` : undefined,
          paddingLeft: cardPadding ? `${cardPadding.left}px` : undefined,
          paddingRight: cardPadding ? `${cardPadding.right}px` : undefined,
        }}
      >
        <CardHeader>
          <CardTitle>{(props.title as string) ?? 'Card Title'}</CardTitle>
          <CardDescription>{(props.description as string) ?? 'Card description goes here.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{(props.content as string) ?? 'Card content area.'}</p>
        </CardContent>
      </Card>
    )
  }

  if (name === 'Checkbox') {
    const cbSize = (props.size as string) ?? 'default'
    const cbShape = (props.shape as string) ?? 'square'
    const isIndeterminate = (props.indeterminate as boolean) ?? false
    const isChecked = (props.checked as boolean) ?? false
    const checkedValue = isIndeterminate ? ('indeterminate' as const) : isChecked
    const sizeClass = cbSize === 'sm' ? 'h-3.5 w-3.5' : cbSize === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
    const checkedColor = (props.checkedColor as string) || undefined
    const labelColor = (props.labelColor as string) || undefined
    return (
      <div className="flex items-start gap-3">
        <Checkbox
          id="cb-preview"
          checked={checkedValue}
          disabled={(props.disabled as boolean) ?? false}
          onCheckedChange={(v) => updateProp('checked', !!v)}
          className={cn(sizeClass, cbShape === 'circle' && 'rounded-full', checkedColor && 'checkbox-colored')}
          style={checkedColor ? { '--checkbox-color': checkedColor } as React.CSSProperties : {}}
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="cb-preview" className="text-sm cursor-pointer" style={labelColor ? { color: labelColor } : {}}>
            {(props.label as string) ?? 'Accept terms and conditions'}
          </Label>
          {(props.description as string) && (
            <p className="text-xs text-muted-foreground">{props.description as string}</p>
          )}
        </div>
      </div>
    )
  }

  if (name === 'Dialog') {
    return <DialogPreview props={props} globalRadius={globalRadius} />
  }

  if (name === 'Dropdown Menu') {
    const dmItemCount = (props.itemCount as number) ?? 3
    const dmSide = ((props.side as string) ?? 'bottom') as 'top' | 'right' | 'bottom' | 'left'
    const dmAlign = ((props.align as string) ?? 'start') as 'start' | 'center' | 'end'
    const dmShowSep = (props.showSeparator as boolean) ?? false
    const dmShowIcons = (props.showIcons as boolean) ?? false
    const dmShowShortcuts = (props.showShortcuts as boolean) ?? false
    const shortcuts = ['⌘K', '⌘S', '⌘D', '⌘E', '⌘R']
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Open Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={dmSide}
          align={dmAlign}
          style={{
            backgroundColor: (props.bgColor as string) || 'hsl(var(--popover))',
            color: (props.textColor as string) || 'hsl(var(--popover-foreground))',
            borderRadius: radius,
          }}
        >
          {Array.from({ length: dmItemCount }, (_, i) => {
            const itemIcon = dmShowIcons ? (props[`item${i}Icon`] as string) ?? null : null
            const ItemIcon = itemIcon ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[itemIcon] ?? null : null
            return (
              <span key={i}>
                {dmShowSep && i === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem>
                  {ItemIcon && <ItemIcon size={14} className="mr-2 shrink-0" />}
                  {(props[`item${i}Label`] as string) ?? `Item ${i + 1}`}
                  {dmShowShortcuts && <DropdownMenuShortcut>{shortcuts[i] ?? `⌘${i + 1}`}</DropdownMenuShortcut>}
                </DropdownMenuItem>
              </span>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (name === 'Input') {
    const hasError = (props.errorState as boolean) ?? false
    const inputPadding = props.padding as PaddingValue | undefined
    return (
      <div className="flex flex-col gap-1.5">
        <Input
          placeholder={(props.placeholder as string) ?? 'Enter text...'}
          disabled={(props.disabled as boolean) ?? false}
          className={cn('w-[280px]', hasError && 'border-destructive')}
          style={{
            backgroundColor: (props.bgColor as string) ?? 'hsl(var(--background))',
            color: (props.textColor as string) ?? 'hsl(var(--foreground))',
            borderColor: hasError ? undefined : props.borderColor as string | undefined,
            borderRadius: radius,
            borderWidth: props.strokeWidth ? `${props.strokeWidth}px` : undefined,
            paddingTop: inputPadding ? `${inputPadding.top}px` : undefined,
            paddingBottom: inputPadding ? `${inputPadding.bottom}px` : undefined,
            paddingLeft: inputPadding ? `${inputPadding.left}px` : undefined,
            paddingRight: inputPadding ? `${inputPadding.right}px` : undefined,
          }}
        />
        {hasError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            {(props.errorMessage as string) ?? 'This field is required.'}
          </p>
        )}
      </div>
    )
  }

  if (name === 'Label') {
    const fontWeightMap: Record<string, string> = { normal: '400', medium: '500', semibold: '600', bold: '700' }
    const letterSpacingMap: Record<string, string> = { tight: '-0.025em', normal: '0em', wide: '0.05em' }
    const isDisabled = (props.disabled as boolean) ?? false
    return (
      <Label
        className={cn('text-sm', isDisabled && 'opacity-50 cursor-not-allowed')}
        style={{
          fontSize: `${(props.fontSize as number) ?? 14}px`,
          fontWeight: fontWeightMap[(props.fontWeight as string) ?? 'medium'] ?? '500',
          letterSpacing: letterSpacingMap[(props.letterSpacing as string) ?? 'normal'] ?? '0em',
          color: (props.textColor as string) || 'hsl(var(--foreground))',
        }}
      >
        {(props.text as string) ?? 'Form label'}
        {(props.required as boolean) && <span className="text-destructive ml-0.5">*</span>}
      </Label>
    )
  }

  if (name === 'Popover') {
    return <PopoverPreview props={props} globalRadius={globalRadius} />
  }

  if (name === 'Progress') {
    const progressVal = Math.min(100, Math.max(0, (props.value as number) ?? 60))
    const progressSize = (props.size as string) ?? 'default'
    const progressStyle = (props.style as string) ?? 'default'
    const sizeClass = progressSize === 'sm' ? 'h-1.5' : progressSize === 'lg' ? 'h-4' : 'h-2.5'
    const indicatorColor = (props.indicatorColor as string) || 'hsl(var(--primary))'
    const trackColor = (props.trackColor as string) || undefined
    const progressRadius = props.borderRadius !== undefined ? `${props.borderRadius}px` : radius
    return (
      <div
        className="w-[280px]"
        style={{ '--progress-indicator': indicatorColor } as React.CSSProperties}
      >
        <Progress
          value={progressStyle === 'indeterminate' ? undefined : progressVal}
          className={cn(sizeClass, 'w-full progress-colored', progressStyle === 'indeterminate' && 'animate-pulse')}
          style={{ backgroundColor: trackColor, borderRadius: progressRadius }}
        />
      </div>
    )
  }

  if (name === 'Radio Group') {
    const rgOrientation = (props.orientation as string) ?? 'vertical'
    const rgOptionCount = (props.optionCount as number) ?? 3
    const rgDisabled = (props.disabled as boolean) ?? false
    const labelColor = (props.labelColor as string) || undefined
    return (
      <div className="flex items-center justify-center w-full">
        <RadioGroup
          value={(props.defaultValue as string) ?? 'option1'}
          onValueChange={(v) => updateProp('defaultValue', v)}
          disabled={rgDisabled}
          className={cn(rgOrientation === 'horizontal' ? 'flex flex-row gap-4' : 'flex flex-col gap-2')}
        >
          {Array.from({ length: rgOptionCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <RadioGroupItem value={`option${i + 1}`} id={`rg-${i}`} />
              <Label htmlFor={`rg-${i}`} className="text-sm cursor-pointer" style={labelColor ? { color: labelColor } : {}}>
                {(props[`option${i + 1}Label`] as string) ?? `Option ${i + 1}`}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    )
  }

  if (name === 'Select') {
    const selectWidth = (props.width as number) ?? 200
    const selectSize = (props.size as string) ?? 'default'
    const selectOptionCount = (props.optionCount as number) ?? 3
    const sizeClass = selectSize === 'sm' ? 'h-8' : selectSize === 'lg' ? 'h-12' : 'h-10'
    const selectRadius = props.borderRadius !== undefined ? `${props.borderRadius}px` : radius
    return (
      <div className="flex items-center justify-center w-full">
        <Select disabled={(props.disabled as boolean) ?? false}>
          <SelectTrigger
            className={sizeClass}
            style={{
              width: `${selectWidth}px`,
              backgroundColor: (props.bgColor as string) || 'hsl(var(--background))',
              borderColor: (props.borderColor as string) || undefined,
              color: (props.textColor as string) || 'hsl(var(--foreground))',
              borderRadius: selectRadius,
            }}
          >
            <SelectValue placeholder={(props.placeholder as string) ?? 'Select option'} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: selectOptionCount }, (_, i) => (
              <SelectItem key={i} value={`opt${i + 1}`}>
                {(props[`option${i + 1}Label`] as string) ?? `Option ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (name === 'Separator') {
    const sepOrientation = (props.orientation as 'horizontal' | 'vertical') ?? 'horizontal'
    const sepThickness = (props.thickness as number) ?? 1
    const sepColor = (props.color as string) || undefined
    const sepMargin = props.margin as PaddingValue | undefined
    const sepStyle: React.CSSProperties = {
      backgroundColor: sepColor,
      ...(sepOrientation === 'horizontal' ? { height: `${sepThickness}px` } : { width: `${sepThickness}px` }),
      ...(sepMargin ? { marginTop: `${sepMargin.top}px`, marginRight: `${sepMargin.right}px`, marginBottom: `${sepMargin.bottom}px`, marginLeft: `${sepMargin.left}px` } : {}),
    }
    return sepOrientation === 'vertical' ? (
      <div className="flex h-28 items-stretch gap-6">
        <p className="text-sm text-muted-foreground self-center">Section above</p>
        <Separator orientation="vertical" style={sepStyle} />
        <p className="text-sm text-muted-foreground self-center">Section below</p>
      </div>
    ) : (
      <div className="flex flex-col w-[280px]">
        <p className="text-sm text-muted-foreground">Section above</p>
        <Separator style={sepStyle} />
        <p className="text-sm text-muted-foreground">Section below</p>
      </div>
    )
  }

  if (name === 'Sheet') {
    return <SheetPreview props={props} />
  }

  if (name === 'Skeleton') {
    const skPreset = (props.preset as string) ?? 'text-lines'
    const skStyle = (props.baseColor as string) ? { backgroundColor: props.baseColor as string } : undefined
    const skRadius = props.borderRadius !== undefined ? `${props.borderRadius}px` : undefined
    const mkSk = (cls: string, extraStyle?: React.CSSProperties) => (
      <Skeleton className={cls} style={{ ...skStyle, ...(skRadius ? { borderRadius: skRadius } : {}), ...extraStyle }} />
    )
    if (skPreset === 'card') {
      return (
        <div className="flex flex-col gap-3 w-[240px]">
          {mkSk('h-32 w-full rounded-lg')}
          {mkSk('h-4 w-full')}
          {mkSk('h-4 w-3/4')}
        </div>
      )
    }
    if (skPreset === 'avatar-row') {
      return (
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" style={skStyle} />
          <div className="flex flex-col gap-2 flex-1">
            {mkSk('h-3.5 w-3/4')}
            {mkSk('h-3.5 w-1/2')}
          </div>
        </div>
      )
    }
    if (skPreset === 'form') {
      return (
        <div className="flex flex-col gap-3 w-[240px]">
          {mkSk('h-3.5 w-1/3')}
          {mkSk('h-9 w-full')}
          {mkSk('h-3.5 w-1/3')}
          {mkSk('h-9 w-full')}
        </div>
      )
    }
    if (skPreset === 'custom') {
      const lineCount = (props.lineCount as number) ?? 3
      const lineHeight = (props.lineHeight as number) ?? 16
      const lineWidth = (props.lineWidth as string) ?? 'full'
      const widthOptions = ['w-full', 'w-3/4', 'w-1/2']
      return (
        <div className="flex flex-col gap-2 w-[240px]">
          {Array.from({ length: lineCount }, (_, i) => {
            const wCls = lineWidth === 'random' ? widthOptions[i % widthOptions.length] : lineWidth === 'full' ? 'w-full' : lineWidth === '3/4' ? 'w-3/4' : 'w-1/2'
            return mkSk(wCls, { height: `${lineHeight}px` })
          })}
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-2">
        {mkSk('h-4 w-[250px]')}
        {mkSk('h-4 w-[200px]')}
        {mkSk('h-4 w-[150px]')}
      </div>
    )
  }

  if (name === 'Slider') {
    const sliderVal = Number(props.value ?? 50)
    const sliderMin = (props.min as number) ?? 0
    const sliderMax = (props.max as number) ?? 100
    const sliderStep = (props.step as number) ?? 1
    const isVertical = (props.orientation as string) === 'vertical'
    const showLabel = (props.showLabel as boolean) ?? false
    return (
      <div className={cn('flex', isVertical ? 'flex-row gap-3 items-start' : 'flex-col gap-2 items-start')}>
        {showLabel && <span className="text-sm font-mono">{sliderVal}</span>}
        <Slider
          value={[sliderVal]}
          onValueChange={(v) => updateProp('value', v[0])}
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          disabled={(props.disabled as boolean) ?? false}
          orientation={isVertical ? 'vertical' : 'horizontal'}
          className={isVertical ? 'h-40' : 'w-[280px]'}
        />
      </div>
    )
  }

  if (name === 'Switch') {
    const checked = (props.checked as boolean) ?? false
    const trackColor = props.switchTrackColor as string | undefined
    return (
      <div className="flex items-center gap-2">
        <div
          style={trackColor ? { '--switch-color': trackColor } as React.CSSProperties : undefined}
        >
          <Switch
            id="sw-preview"
            checked={checked}
            disabled={(props.disabled as boolean) ?? false}
            onCheckedChange={(v: boolean) => updateProp('checked', v)}
            className={trackColor ? 'switch-colored' : ''}
          />
        </div>
        <Label htmlFor="sw-preview" className="text-sm cursor-pointer">
          {(props.label as string) ?? 'Enable feature'}
        </Label>
      </div>
    )
  }

  if (name === 'Table') {
    const tableVariant = (props.variant as string) ?? 'default'
    const colCount = (props.colCount as number) ?? 3
    const rowCount = (props.rowCount as number) ?? 3
    const showHeader = (props.showHeader as boolean) ?? true
    const headerBg = (props.headerBg as string) ?? ''
    const stripeColor = (props.stripeColor as string) ?? ''
    const borderColor = (props.borderColor as string) ?? ''
    const colHeaders = ['Name', 'Status', 'Role', 'Email', 'Amount', 'Date'].slice(0, colCount)
    const rowData = [
      ['Alice', 'Active', 'Admin', 'alice@example.com', '$120', 'Jan 1'],
      ['Bob', 'Inactive', 'Editor', 'bob@example.com', '$200', 'Feb 3'],
      ['Carol', 'Active', 'Viewer', 'carol@example.com', '$80', 'Mar 7'],
      ['Dave', 'Pending', 'Admin', 'dave@example.com', '$340', 'Apr 9'],
      ['Eve', 'Active', 'Editor', 'eve@example.com', '$55', 'May 12'],
    ].slice(0, rowCount)
    const isBorderless = tableVariant === 'borderless'
    const isCompact = tableVariant === 'compact'
    const cellPad = isCompact ? 'py-1 px-3' : 'py-2 px-4'
    return (
      <div className="flex items-center justify-center w-full">
      <Table
        className="w-[400px]"
        style={borderColor && !isBorderless ? { borderColor, '--tw-border-opacity': '1' } as React.CSSProperties : {}}
      >
        {showHeader && (
          <TableHeader>
            <TableRow style={headerBg ? { backgroundColor: headerBg } : {}}>
              {colHeaders.map((h) => (
                <TableHead
                  key={h}
                  className={cn(cellPad, isBorderless && 'border-0')}
                  style={borderColor && !isBorderless ? { borderColor } : {}}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {rowData.map((row, ri) => (
            <TableRow
              key={ri}
              className={cn(isBorderless && 'border-0')}
              style={{
                ...(tableVariant === 'striped' && ri % 2 === 1 && stripeColor ? { backgroundColor: stripeColor } : {}),
                ...(borderColor && !isBorderless ? { borderColor } : {}),
              }}
            >
              {row.map((cell, ci) => (
                <TableCell
                  key={ci}
                  className={cn(cellPad, isBorderless && 'border-0')}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    )
  }

  if (name === 'Tabs') {
    const tabVariant = (props.variant as string) ?? 'default'
    const tabCount = (props.tabCount as number) ?? 3
    const tabs = Array.from({ length: tabCount }, (_, i) => ({
      value: `tab${i}`,
      label: (props[`tab${i}Label`] as string) ?? `Tab ${i + 1}`,
    }))
    const listClass = cn(
      tabVariant === 'underline' && '!bg-transparent border-0 border-b border-border rounded-none p-0 h-auto gap-6',
      tabVariant === 'pill' && '!rounded-full',
      tabVariant === 'bordered' && '!bg-transparent !rounded-none border-b border-border',
    )
    const triggerClass = cn(
      tabVariant === 'underline' && 'border-0 border-b-2 border-transparent rounded-none shadow-none px-1 pb-2 data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground',
      tabVariant === 'pill' && '!rounded-full',
      tabVariant === 'bordered' && 'border border-transparent rounded-t-md data-[state=active]:!bg-background data-[state=active]:border-border',
    )
    return (
      <Tabs defaultValue="tab0" className="w-[320px]">
        <TabsList className={listClass}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={triggerClass}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab, i) => (
          <TabsContent key={tab.value} value={tab.value} className="text-sm text-muted-foreground pt-2">
            {(props[`tab${i}Content`] as string) ?? `Content for ${tab.label}.`}
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  if (name === 'Textarea') {
    const taResize = (props.resize as string) ?? 'vertical'
    const taRows = (props.rows as number) ?? 4
    const taBg = (props.bgColor as string) ?? ''
    const taBorder = (props.borderColor as string) ?? ''
    const taText = (props.textColor as string) ?? ''
    const taRadius = props.borderRadius !== undefined ? `${props.borderRadius as number}px` : undefined
    const taPad = props.padding !== undefined ? `${props.padding as number}px` : undefined
    const taFontSize = (props.fontSize as string) ?? '14px'
    const taFontWeight = (props.fontWeight as string) ?? '400'
    const taDisabled = (props.disabled as boolean) ?? false
    const taReadOnly = (props.readOnly as boolean) ?? false
    const taError = (props.error as boolean) ?? false
    const resizeMap: Record<string, string> = { none: 'none', vertical: 'vertical', horizontal: 'horizontal', both: 'both' }
    return (
      <Textarea
        placeholder={(props.placeholder as string) ?? 'Type your message here.'}
        rows={taRows}
        disabled={taDisabled}
        readOnly={taReadOnly}
        className={cn('w-[280px]', taError && 'border-destructive focus-visible:ring-destructive')}
        style={{
          resize: resizeMap[taResize] as React.CSSProperties['resize'],
          backgroundColor: taBg || 'hsl(var(--background))',
          ...(taBorder ? { borderColor: taBorder } : {}),
          color: taText || 'hsl(var(--foreground))',
          ...(taRadius !== undefined ? { borderRadius: taRadius } : {}),
          ...(taPad !== undefined ? { padding: taPad } : {}),
          fontSize: taFontSize,
          fontWeight: taFontWeight,
        }}
      />
    )
  }

  if (name === 'Toast') {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 w-[320px] flex flex-col gap-1">
        <p className="text-sm font-semibold">{(props.title as string) ?? 'Scheduled: Catch up'}</p>
        <p className="text-sm text-muted-foreground">{(props.description as string) ?? 'Friday, February 10, 2023 at 5:57 PM'}</p>
      </div>
    )
  }

  if (name === 'Toggle') {
    const toggleVariant = ((props.variant as string) ?? 'default') as 'default' | 'outline'
    const toggleSize = ((props.size as string) ?? 'default') as 'default' | 'sm' | 'lg'
    const isPressed = (props.pressed as boolean) ?? false
    const showIcon = (props.showIcon as boolean) ?? false
    const iconPosition = (props.iconPosition as string) ?? 'leading'
    const ToggleIcon = showIcon && props.icon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.icon as string] ?? null
      : null
    return (
      <Toggle
        pressed={isPressed}
        onPressedChange={(v) => updateProp('pressed', v)}
        variant={toggleVariant}
        size={toggleSize}
        disabled={(props.disabled as boolean) ?? false}
        style={{
          backgroundColor: isPressed ? (props.activeColor as string) || undefined : (props.inactiveColor as string) || undefined,
          color: isPressed ? (props.activeTextColor as string) || undefined : undefined,
        }}
      >
        {showIcon && ToggleIcon && iconPosition !== 'trailing' && <ToggleIcon size={16} />}
        {iconPosition !== 'only' && ((props.label as string) ?? 'Toggle')}
        {showIcon && ToggleIcon && iconPosition === 'trailing' && <ToggleIcon size={16} />}
      </Toggle>
    )
  }

  if (name === 'Tooltip') {
    const tooltipSide = ((props.side as string) ?? 'top') as 'top' | 'right' | 'bottom' | 'left'
    const tooltipRadius = props.borderRadius !== undefined ? `${props.borderRadius}px` : radius
    return (
      <TooltipProvider delayDuration={(props.delayDuration as number) ?? 200}>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="outline">{(props.triggerLabel as string) ?? 'Hover me'}</Button>
          </TooltipTrigger>
          <TooltipContent
            side={tooltipSide}
            style={{
              backgroundColor: (props.bgColor as string) || 'hsl(var(--popover))',
              color: (props.textColor as string) || 'hsl(var(--popover-foreground))',
              borderRadius: tooltipRadius,
            }}
          >
            <p>{(props.content as string) ?? 'Tooltip content'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (name === 'Breadcrumb') {
    const bcItemCount = (props.itemCount as number) ?? 3
    const bcMaxVisible = (props.maxVisible as number) ?? 99
    const bcSepStyle = (props.separatorStyle as string) ?? 'slash'
    const bcFontSize = (props.fontSize as number) ?? 14
    const fontWeightMap: Record<string, string> = { normal: '400', medium: '500', semibold: '600' }
    const bcFontWeight = fontWeightMap[(props.fontWeight as string) ?? 'medium'] ?? '500'
    const bcLinkColor = (props.linkColor as string) || undefined
    const bcActiveColor = (props.activeColor as string) || undefined
    const bcSepColor = (props.separatorColor as string) || undefined
    const allItems = Array.from({ length: bcItemCount }, (_, i) =>
      (props[`item${i}Label`] as string) ?? (['Home', 'Projects', 'Current Page', 'Details', 'Edit'][i] ?? `Item ${i + 1}`)
    )
    const visibleItems = allItems.length > bcMaxVisible
      ? [allItems[0], '...', allItems[allItems.length - 1]]
      : allItems
    const BcSepIcon = bcSepStyle === 'chevron'
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)['ChevronRight'] ?? null
      : bcSepStyle === 'arrow'
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)['ArrowRight'] ?? null
      : null
    return (
      <Breadcrumb>
        <BreadcrumbList style={{ fontSize: `${bcFontSize}px` }}>
          {visibleItems.map((item, i) => (
            <BreadcrumbItem key={i}>
              {item === '...' ? (
                <BreadcrumbEllipsis />
              ) : i === visibleItems.length - 1 ? (
                <BreadcrumbPage style={{ fontWeight: bcFontWeight, color: bcActiveColor }}>{item}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink style={{ color: bcLinkColor || 'hsl(var(--primary))' }}>{item}</BreadcrumbLink>
              )}
              {i < visibleItems.length - 1 && (
                <BreadcrumbSeparator style={{ color: bcSepColor }}>
                  {bcSepStyle === 'slash' ? <span>/</span>
                   : bcSepStyle === 'dot' ? <span>·</span>
                   : BcSepIcon ? <BcSepIcon size={14} />
                   : null}
                </BreadcrumbSeparator>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  if (name === 'Button Group') {
    const bgButtons = Array.from({ length: (props.buttonCount as number) ?? 3 })
    const bgRadius = (props.borderRadius as number) ?? globalRadius
    const bgActiveColor = (props.activeColor as string) || undefined
    const bgActiveTextColor = (props.activeTextColor as string) || undefined
    const bgInactiveColor = (props.inactiveColor as string) || undefined
    const bgBorderColor = (props.borderColor as string) || undefined
    return (
      <div className="flex">
        {bgButtons.map((_, i) => {
          const label = (props[`btn${i}Label`] as string) ?? `Option ${i + 1}`
          const BgIcon = props[`btn${i}Icon`]
            ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props[`btn${i}Icon`] as string] ?? null
            : (props.iconOnly as boolean)
            ? LucideIcons.Square as LucideIconComp
            : null
          const isFirst = i === 0
          const isLast = i === bgButtons.length - 1
          const isActive = ((props.activeIndex as number) ?? 0) === i
          return (
            <button
              key={i}
              onClick={() => updateProp('activeIndex', i)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border transition-colors cursor-pointer"
              style={{
                borderRadius: isFirst
                  ? `${bgRadius}px 0 0 ${bgRadius}px`
                  : isLast
                  ? `0 ${bgRadius}px ${bgRadius}px 0`
                  : '0',
                marginLeft: !isFirst ? '-1px' : undefined,
                backgroundColor: isActive ? (bgActiveColor ?? CSS_PRIMARY) : bgInactiveColor,
                color: isActive ? (bgActiveTextColor ?? CSS_PRIMARY_FG) : undefined,
                borderColor: bgBorderColor,
                zIndex: isActive ? 10 : undefined,
              }}
            >
              {BgIcon && <BgIcon size={14} />}
              {!(props.iconOnly as boolean) && label}
            </button>
          )
        })}
      </div>
    )
  }

  if (name === 'Sidebar') {
    const sbCollapsed = (props.collapsed as boolean) ?? false
    const sbWidth = sbCollapsed ? 56 : (props.width as number) ?? 220
    const sbItemCount = (props.itemCount as number) ?? 4
    const sbStyle = (props.style as string) ?? 'default'
    const sbBg = (props.bgColor as string) || 'hsl(var(--background))'
    const sbActiveColor = (props.activeColor as string) ?? undefined
    const sbBorderColor = (props.borderColor as string) || undefined
    const sbTextColor = (props.textColor as string) || 'hsl(var(--foreground))'
    const sbRadius = (props.borderRadius as number) ?? globalRadius
    const defaultLabels = ['Dashboard', 'Projects', 'Components', 'Settings', 'Analytics', 'Help']
    const defaultIconNames = ['LayoutDashboard', 'FolderOpen', 'Box', 'Settings', 'BarChart2', 'HelpCircle']
    const sbContainerClass = cn(
      'flex h-[320px] rounded-lg overflow-hidden border border-border',
      sbStyle === 'floating' && 'shadow-lg',
      sbStyle === 'inset' && 'bg-muted/30 p-2',
    )
    return (
      <div className={sbContainerClass}>
        <div
          className="flex flex-col h-full border-r border-border transition-all duration-200 shrink-0"
          style={{ width: `${sbWidth}px`, backgroundColor: sbBg, borderColor: sbBorderColor }}
        >
          <div className="flex items-center gap-2 px-3 py-4 border-b border-border/40">
            <div className="h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: CSS_PRIMARY }} />
            {!sbCollapsed && (
              <span className="font-semibold text-sm truncate" style={{ color: sbTextColor }}>
                {(props.appName as string) ?? 'Blox'}
              </span>
            )}
          </div>
          <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2">
            {Array.from({ length: sbItemCount }, (_, i) => {
              const label = (props[`item${i}Label`] as string) ?? (defaultLabels[i] ?? `Item ${i + 1}`)
              const iconName = (props[`item${i}Icon`] as string) ?? (defaultIconNames[i] ?? 'Circle')
              const NavIcon = (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[iconName] ?? null
              const isActive = ((props.activeItem as number) ?? 0) === i
              return (
                <button
                  key={i}
                  onClick={() => updateProp('activeItem', i)}
                  className="flex items-center gap-2.5 py-2 text-sm transition-colors cursor-pointer w-full text-left"
                  style={{
                    paddingLeft: '10px',
                    paddingRight: '8px',
                    borderRadius: `${sbRadius}px`,
                    backgroundColor: isActive
                      ? (sbActiveColor ? `${sbActiveColor}22` : 'hsl(var(--primary) / 0.1)')
                      : undefined,
                    color: isActive ? (sbActiveColor ?? CSS_PRIMARY) : (sbTextColor ?? undefined),
                    fontWeight: isActive ? '500' : undefined,
                    borderLeft: isActive
                      ? `2px solid ${sbActiveColor ?? CSS_PRIMARY}`
                      : '2px solid transparent',
                  }}
                >
                  {NavIcon && <NavIcon size={16} className="shrink-0" />}
                  {!sbCollapsed && <span className="truncate">{label}</span>}
                </button>
              )
            })}
          </nav>
          <div className="flex items-center gap-2 px-3 py-3 border-t border-border/40">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-medium">AC</span>
            </div>
            {!sbCollapsed && (
              <span className="text-xs text-muted-foreground truncate">Alex Chen</span>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <p className="text-xs text-muted-foreground/50">Main content</p>
        </div>
      </div>
    )
  }

  if (name === 'Bar Chart') {
    const barData = [
      { name: 'Jan', value: 400, value2: 240 },
      { name: 'Feb', value: 300, value2: 139 },
      { name: 'Mar', value: 600, value2: 380 },
      { name: 'Apr', value: 800, value2: 430 },
      { name: 'May', value: 500, value2: 290 },
      { name: 'Jun', value: 900, value2: 480 },
    ]
    const barLayout = (props.layout as string) ?? 'vertical'
    const barRad = (props.barRadius as number) ?? 4
    const barColor = (props.barColor as string) ?? 'hsl(var(--primary))'
    const bar2Color = (props.bar2Color as string) || '#94a3b8'
    const gridColor = (props.gridColor as string) || undefined
    const bgColor = (props.bgColor as string) || 'hsl(var(--background))'
    const showGrid = (props.showGrid as boolean) ?? false
    const showSecondSeries = (props.showSecondSeries as boolean) ?? false
    const series1Label = (props.series1Label as string) ?? 'Series 1'
    const series2Label = (props.series2Label as string) ?? 'Series 2'
    const isHorizontal = barLayout === 'horizontal'
    return (
      <div className="flex items-center justify-center w-full">
      <div className="w-[380px] h-[260px] rounded-lg overflow-hidden" style={{ backgroundColor: bgColor }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout={isHorizontal ? 'vertical' : 'horizontal'}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
            <XAxis
              dataKey={isHorizontal ? undefined : 'name'}
              type={isHorizontal ? 'number' : 'category'}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              dataKey={isHorizontal ? 'name' : undefined}
              type={isHorizontal ? 'category' : 'number'}
              tick={{ fontSize: 11 }}
            />
            {props.showTooltip !== false && <RechartsTooltip />}
            {props.showLegend && <Legend />}
            <Bar dataKey="value" name={series1Label} fill={barColor} radius={barRad} />
            {showSecondSeries && <Bar dataKey="value2" name={series2Label} fill={bar2Color} radius={barRad} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
    )
  }

  if (name === 'Line Chart') {
    const lineData = [
      { name: 'Jan', value: 400, value2: 240 },
      { name: 'Feb', value: 300, value2: 139 },
      { name: 'Mar', value: 600, value2: 380 },
      { name: 'Apr', value: 800, value2: 430 },
      { name: 'May', value: 500, value2: 290 },
      { name: 'Jun', value: 900, value2: 480 },
    ]
    const lineColor = (props.lineColor as string) ?? 'hsl(var(--primary))'
    const line2Color = (props.line2Color as string) || '#94a3b8'
    const gridColor = (props.gridColor as string) || undefined
    const filled = (props.filled as boolean) ?? false
    const curve = ((props.curve as string) ?? 'monotone') as 'monotone' | 'linear' | 'step' | 'natural'
    const strokeW = (props.strokeWidth as number) ?? 2
    const showDots = (props.showDots as boolean) ?? false
    const showGrid = (props.showGrid as boolean) ?? false
    const showSecondSeries = (props.showSecondSeries as boolean) ?? false
    const series1Label = (props.series1Label as string) ?? 'Series 1'
    const series2Label = (props.series2Label as string) ?? 'Series 2'
    return (
      <div className="flex items-center justify-center w-full">
      <div className="w-[380px] h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {filled ? (
            <AreaChart data={lineData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
              {props.showTooltip !== false && <RechartsTooltip />}
              {props.showLegend && <Legend />}
              <Area type={curve} dataKey="value" name={series1Label} stroke={lineColor} fill={lineColor} fillOpacity={0.2} strokeWidth={strokeW} dot={showDots} />
              {showSecondSeries && <Area type={curve} dataKey="value2" name={series2Label} stroke={line2Color} fill={line2Color} fillOpacity={0.2} strokeWidth={strokeW} dot={showDots} />}
            </AreaChart>
          ) : (
            <LineChart data={lineData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
              {props.showTooltip !== false && <RechartsTooltip />}
              {props.showLegend && <Legend />}
              <Line type={curve} dataKey="value" name={series1Label} stroke={lineColor} strokeWidth={strokeW} dot={showDots} />
              {showSecondSeries && <Line type={curve} dataKey="value2" name={series2Label} stroke={line2Color} strokeWidth={strokeW} dot={showDots} />}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      </div>
    )
  }

  return null
}

// ─── Export Sheet ─────────────────────────────────────────────────────────────

function ExportSheet({
  open,
  onOpenChange,
  component,
  props,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  component: string
  props: ComponentProps
}) {
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedUsage, setCopiedUsage] = useState(false)

  const { full, usage } = generateTSX(component, props)

  function copyFull() {
    navigator.clipboard.writeText(full)
    setCopiedFull(true)
    setTimeout(() => setCopiedFull(false), 2000)
  }

  function copyUsage() {
    navigator.clipboard.writeText(usage)
    setCopiedUsage(true)
    setTimeout(() => setCopiedUsage(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Export {component}</SheetTitle>
          <SheetDescription>
            Copy this into your codebase. It uses your configured props and shadcn primitives.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Component code
          </p>
          <pre className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground overflow-x-auto whitespace-pre border border-border">
            {full}
          </pre>

          <p className="text-xs uppercase tracking-wide text-muted-foreground mt-6 mb-2">
            Usage
          </p>
          <pre className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground overflow-x-auto whitespace-pre border border-border">
            {usage}
          </pre>

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={copyFull}>
              {copiedFull ? 'Copied!' : 'Copy component'}
            </Button>
            <Button size="sm" variant="outline" onClick={copyUsage}>
              {copiedUsage ? 'Copied!' : 'Copy usage'}
            </Button>
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = projectId ? loadProject(projectId) : null
  const paletteColors: string[] = project?.colors ?? []
  const primaryColor: string = project?.primaryColor ?? '#000000'

  useProjectTokens(primaryColor, paletteColors)

  const [activePrimaryColor, setActivePrimaryColor] = useState(
    project?.primaryColor ?? '#000000'
  )

  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [allComponentProps, setAllComponentProps] = useState<Record<string, ComponentProps>>(() => {
    if (!projectId) return {}
    try {
      const stored = localStorage.getItem(getPropsKey(projectId))
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, ComponentProps>
      }
    } catch {
      // fall through
    }
    return {}
  })
  const [projectSettings, setProjectSettings] = useState<{ globalRadius: number }>(() => {
    if (!projectId) return { globalRadius: 6 }
    try {
      const stored = localStorage.getItem(`blox_project_settings_${projectId}`)
      return stored ? (JSON.parse(stored) as { globalRadius: number }) : { globalRadius: 6 }
    } catch {
      return { globalRadius: 6 }
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [activeThemeId, setActiveThemeId] = useState(projectId ?? '')
  const [activeDots, setActiveDots] = useState(paletteColors)

  function applyTheme(themePrimary: string, colors: string[], id: string) {
    injectTokens(themePrimary, colors)
    setActiveThemeId(id)
    setActiveDots(colors)
    setActivePrimaryColor(themePrimary)
    setThemeOpen(false)
    setAllComponentProps(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(comp => {
        next[comp] = { ...next[comp], bgColor: undefined, textColor: undefined }
      })
      return next
    })
  }

  useEffect(() => {
    if (!projectId) return
    localStorage.setItem(getPropsKey(projectId), JSON.stringify(allComponentProps))
  }, [allComponentProps, projectId])

  useEffect(() => {
    if (!projectId) return
    localStorage.setItem(`blox_project_settings_${projectId}`, JSON.stringify(projectSettings))
  }, [projectSettings, projectId])

  const currentProps = selectedComponent ? (allComponentProps[selectedComponent] ?? {}) : {}

  const updateProp: UpdateProp = (key, value) => {
    if (!selectedComponent) return
    setAllComponentProps((prev) => ({
      ...prev,
      [selectedComponent]: {
        ...(prev[selectedComponent] ?? {}),
        [key]: value,
      },
    }))
  }

  const filteredComponents = COMPONENTS.filter((c) =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-sans">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-foreground">Project not found</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background font-sans overflow-hidden">

        {/* ── Topbar ── */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-1.5 h-full min-w-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
              Projects
            </button>
            <span className="mx-2 text-muted-foreground/40 text-sm">/</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[160px]">
              {project.name}
            </span>
            <span className="mx-2 text-muted-foreground/40 text-sm">/</span>
            <span className={cn(
              'text-sm truncate max-w-[140px]',
              selectedComponent ? 'text-muted-foreground' : 'text-muted-foreground/50',
            )}>
              {selectedComponent ?? 'Select a component'}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Popover open={themeOpen} onOpenChange={setThemeOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 cursor-pointer p-1 rounded-md hover:bg-muted transition-colors">
                  {activeDots.slice(0, 3).map((color, i) => (
                    <span
                      key={i}
                      className="inline-block w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                    />
                  ))}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-4 flex flex-col gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Project palettes</p>
                  {(() => {
                    try {
                      const raw = localStorage.getItem('blox_projects')
                      const projects = raw ? (JSON.parse(raw) as Project[]) : []
                      return projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => applyTheme(p.primaryColor, p.colors, p.id)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left transition-colors cursor-pointer border',
                            activeThemeId === p.id
                              ? 'bg-accent/15 border-accent/30'
                              : 'hover:bg-muted border-transparent',
                          )}
                        >
                          <div className="flex gap-1 shrink-0">
                            {p.colors.map((c: string, i: number) => (
                              <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
                            ))}
                          </div>
                          <span className="text-sm truncate flex-1">{p.name}</span>
                          {activeThemeId === p.id && <Check size={14} className="ml-auto text-primary shrink-0" />}
                        </button>
                      ))
                    } catch { return null }
                  })()}
                </div>
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Built-in themes</p>
                  {SHADCN_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyTheme(preset.primary, preset.colors, preset.name)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left transition-colors cursor-pointer border',
                        activeThemeId === preset.name
                          ? 'bg-accent/15 border-accent/30'
                          : 'hover:bg-muted border-transparent',
                      )}
                    >
                      <div className="flex gap-1 shrink-0">
                        {preset.colors.map((c, i) => (
                          <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
                        ))}
                      </div>
                      <span className="text-sm truncate flex-1">{preset.name}</span>
                      {activeThemeId === preset.name && <Check size={14} className="ml-auto text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    className="h-7 rounded-md gap-1.5 text-xs px-3"
                    disabled={!selectedComponent}
                    onClick={() => setExportOpen(true)}
                  >
                    <Download size={14} strokeWidth={1.75} />
                    Export TSX
                  </Button>
                </span>
              </TooltipTrigger>
              {!selectedComponent && (
                <TooltipContent>
                  <p>Select a component first</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>

          {/* ── Left panel ── */}
          <aside className="w-[240px] border-r border-border flex flex-col h-full">
            <p className="px-3 pt-5 pb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0">
              Components
            </p>
            <div className="px-3 pb-2 shrink-0">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs rounded-md"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
              {filteredComponents.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedComponent(name)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md mx-1 text-sm cursor-pointer transition-colors duration-100',
                    selectedComponent === name
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  {name}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Canvas ── */}
          <main className="flex-1 flex items-center justify-center overflow-hidden relative canvas-grid">
            {selectedComponent ? (
              <ComponentPreview
                name={selectedComponent}
                props={currentProps}
                updateProp={updateProp}
                globalRadius={projectSettings.globalRadius}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <LayoutGrid size={40} strokeWidth={1} className="text-muted-foreground/25" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground/60">No component selected</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Pick a component from the left panel to preview and configure it.</p>
                </div>
              </div>
            )}
          </main>

          {/* ── Right panel — Inspector ── */}
          <aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-background overflow-hidden">
            {/* Sticky header */}
            <div className="shrink-0 border-b border-border/40 px-4 pt-4 pb-3">
              <p className={cn(
                'text-sm font-semibold',
                selectedComponent ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {selectedComponent ?? 'Inspector'}
              </p>
              {selectedComponent && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedComponent} component</p>
              )}
            </div>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedComponent ? (
                <Inspector
                  component={selectedComponent}
                  props={currentProps}
                  updateProp={updateProp}
                  paletteColors={paletteColors}
                  primaryColor={activePrimaryColor}
                  globalRadius={projectSettings.globalRadius}
                  onChangeGlobalRadius={(v) => setProjectSettings((prev) => ({ ...prev, globalRadius: v }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground px-4 pt-3">
                  Select a component to configure it.
                </p>
              )}
            </div>
          </aside>

        </div>
      </div>

      {/* ── Export Sheet ── */}
      {selectedComponent && (
        <ExportSheet
          open={exportOpen}
          onOpenChange={setExportOpen}
          component={selectedComponent}
          props={currentProps}
        />
      )}
    </TooltipProvider>
  )
}
