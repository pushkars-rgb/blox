import { useState, useEffect, useMemo, useRef, Fragment, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectTokens, hexToOklch } from '@/hooks/useProjectTokens'
import { useTheme } from '@/hooks/useTheme'
import {
  type SemanticTokenKey,
  type SemanticTokens,
  type TokenPreset,
  type TailwindFamily,
  DEFAULT_TOKENS,
  TOKEN_KEYS,
  TOKEN_LABELS,
  TOKEN_GROUPS,
  TOKEN_CSS_VARS,
  TOKEN_PRESETS,
  CURATED_COLORS,
  TAILWIND_PALETTE,
  injectSemanticTokens,
} from '@/lib/tokens'
import * as LucideIcons from 'lucide-react'
import IconPicker from '@/components/IconPicker'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
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
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
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
import { Check, ChevronDown, ChevronLeft, Download, LayoutGrid, Link, Link2Off, Loader2, Minus, Moon, Plus, RotateCcw, Sun } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaddingValue = { top: number; right: number; bottom: number; left: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentPropsValue = string | boolean | number | PaddingValue | Record<string, any> | undefined
type ComponentProps = Record<string, ComponentPropsValue>
type UpdateProp = (key: string, value: ComponentPropsValue) => void

// Color-override props that are scoped per variant so that customizations made
// for one variant (e.g. 'destructive') don't bleed into another (e.g. 'default').
const VARIANT_SCOPED_PROPS = new Set([
  'bgColor', 'textColor', 'borderColor',
  'descriptionColor',
  'triggerColor', 'contentColor',
  'trackColor', 'labelColor',
  'activeBgColor', 'activeTextColor',
  'fillColor',
  'activeColor', 'inactiveColor',
])

type InspectorSharedProps = {
  props: ComponentProps
  updateProp: UpdateProp
  paletteColors: string[]
  primaryColor: string
  globalRadius: number
  onChangeGlobalRadius: (v: number) => void
}

const defaultPadding: PaddingValue = { top: 0, right: 10, bottom: 0, left: 10 }

type LucideIconComp = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>

type HealthIssue = {
  id: string
  level: 'warning' | 'error'
  title: string
  description?: string
  target?: {
    type: 'component' | 'token' | 'setting'
    name: string
    field?: string
  }
}

type HealthReport = {
  status: 'healthy' | 'warning' | 'error'
  issues: HealthIssue[]
  summary: { errors: number; warnings: number }
}

// TOKEN_PRESETS, TOKEN_PRESETS, CURATED_COLORS etc. are imported from @/lib/tokens

// ─── CSS var helpers ─────────────────────────────────────────────────────────
// IMPORTANT: This project uses Tailwind v4 + OKLCH. CSS vars hold full color
// values, e.g. --primary: oklch(0.205 0 0). Always use var(--token) directly.
// Never wrap in hsl()/rgb() — that produces invalid CSS and renders transparent.

const CSS_PRIMARY = 'var(--primary)'
const CSS_PRIMARY_FG = 'var(--primary-foreground)'

/** Returns the right CSS background property: backgroundImage for gradients, backgroundColor for solids */
function bgStyle(color: string | undefined): React.CSSProperties {
  if (!color) return {}
  return color.startsWith('linear-gradient')
    ? { background: color }
    : { backgroundColor: color }
}

/** Depth-aware parser for linear-gradient(Xdeg, from, to) */
function parseGradient(g: string): { angle: number; from: string; to: string } | null {
  if (!g?.startsWith('linear-gradient(')) return null
  const inner = g.slice('linear-gradient('.length, -1)
  const angleMatch = inner.match(/^(\d+(?:\.\d+)?)deg,\s*/)
  if (!angleMatch) return null
  const angle = parseFloat(angleMatch[1])
  const rest = inner.slice(angleMatch[0].length)
  let depth = 0
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '(') depth++
    else if (rest[i] === ')') depth--
    else if (rest[i] === ',' && depth === 0) {
      return { angle, from: rest.slice(0, i).trim(), to: rest.slice(i + 1).trim() }
    }
  }
  return null
}

// ─── Status icons ─────────────────────────────────────────────────────────────

function IconSuccess({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10 1.875C8.39303 1.875 6.82214 2.35152 5.486 3.24431C4.14985 4.1371 3.10844 5.40605 2.49348 6.8907C1.87852 8.37535 1.71762 10.009 2.03112 11.5851C2.34463 13.1612 3.11846 14.6089 4.25476 15.7452C5.39106 16.8815 6.8388 17.6554 8.41489 17.9689C9.99099 18.2824 11.6247 18.1215 13.1093 17.5065C14.594 16.8916 15.8629 15.8502 16.7557 14.514C17.6485 13.1779 18.125 11.607 18.125 10C18.1227 7.84581 17.266 5.78051 15.7427 4.25727C14.2195 2.73403 12.1542 1.87727 10 1.875ZM13.5672 8.56719L9.19219 12.9422C9.13415 13.0003 9.06522 13.0464 8.98934 13.0779C8.91347 13.1093 8.83214 13.1255 8.75 13.1255C8.66787 13.1255 8.58654 13.1093 8.51067 13.0779C8.43479 13.0464 8.36586 13.0003 8.30782 12.9422L6.43282 11.0672C6.31554 10.9499 6.24966 10.7909 6.24966 10.625C6.24966 10.4591 6.31554 10.3001 6.43282 10.1828C6.55009 10.0655 6.70915 9.99965 6.875 9.99965C7.04086 9.99965 7.19992 10.0655 7.31719 10.1828L8.75 11.6164L12.6828 7.68281C12.7409 7.62474 12.8098 7.57868 12.8857 7.54725C12.9616 7.51583 13.0429 7.49965 13.125 7.49965C13.2071 7.49965 13.2884 7.51583 13.3643 7.54725C13.4402 7.57868 13.5091 7.62474 13.5672 7.68281C13.6253 7.74088 13.6713 7.80982 13.7027 7.88569C13.7342 7.96156 13.7504 8.04288 13.7504 8.125C13.7504 8.20712 13.7342 8.28844 13.7027 8.36431C13.6713 8.44018 13.6253 8.50912 13.5672 8.56719Z" fill="#16A34A"/>
    </svg>
  )
}

function IconWarning({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M18.4999 14.6946L11.6678 2.82974C11.4971 2.53906 11.2534 2.29803 10.9608 2.13057C10.6682 1.9631 10.337 1.875 9.99986 1.875C9.66275 1.875 9.33149 1.9631 9.03892 2.13057C8.74635 2.29803 8.50262 2.53906 8.33189 2.82974L1.49986 14.6946C1.33559 14.9757 1.24902 15.2955 1.24902 15.6211C1.24902 15.9468 1.33559 16.2665 1.49986 16.5477C1.6684 16.8401 1.91171 17.0825 2.20483 17.2498C2.49795 17.4172 2.83032 17.5036 3.16783 17.5001H16.8319C17.1691 17.5033 17.5012 17.4168 17.794 17.2494C18.0868 17.0821 18.3299 16.8399 18.4983 16.5477C18.6628 16.2667 18.7496 15.947 18.7499 15.6214C18.7502 15.2957 18.6639 14.9759 18.4999 14.6946ZM9.37486 8.12505C9.37486 7.95929 9.44071 7.80032 9.55792 7.68311C9.67513 7.5659 9.8341 7.50005 9.99986 7.50005C10.1656 7.50005 10.3246 7.5659 10.4418 7.68311C10.559 7.80032 10.6249 7.95929 10.6249 8.12505V11.2501C10.6249 11.4158 10.559 11.5748 10.4418 11.692C10.3246 11.8092 10.1656 11.8751 9.99986 11.8751C9.8341 11.8751 9.67513 11.8092 9.55792 11.692C9.44071 11.5748 9.37486 11.4158 9.37486 11.2501V8.12505ZM9.99986 15.0001C9.81444 15.0001 9.63319 14.9451 9.47901 14.8421C9.32484 14.739 9.20468 14.5926 9.13372 14.4213C9.06277 14.25 9.0442 14.0615 9.08038 13.8797C9.11655 13.6978 9.20584 13.5308 9.33695 13.3996C9.46806 13.2685 9.63511 13.1792 9.81696 13.1431C9.99882 13.1069 10.1873 13.1255 10.3586 13.1964C10.5299 13.2674 10.6764 13.3875 10.7794 13.5417C10.8824 13.6959 10.9374 13.8771 10.9374 14.0626C10.9374 14.3112 10.8386 14.5496 10.6628 14.7255C10.487 14.9013 10.2485 15.0001 9.99986 15.0001Z" fill="#F59E0B"/>
    </svg>
  )
}

function IconError({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10 1.875C8.39303 1.875 6.82214 2.35152 5.486 3.24431C4.14985 4.1371 3.10844 5.40605 2.49348 6.8907C1.87852 8.37535 1.71762 10.009 2.03112 11.5851C2.34463 13.1612 3.11846 14.6089 4.25476 15.7452C5.39106 16.8815 6.8388 17.6554 8.41489 17.9689C9.99099 18.2824 11.6247 18.1215 13.1093 17.5065C14.594 16.8916 15.8629 15.8502 16.7557 14.514C17.6485 13.1779 18.125 11.607 18.125 10C18.1227 7.84581 17.266 5.78051 15.7427 4.25727C14.2195 2.73403 12.1542 1.87727 10 1.875ZM12.9422 12.0578C13.0003 12.1159 13.0463 12.1848 13.0777 12.2607C13.1092 12.3366 13.1254 12.4179 13.1254 12.5C13.1254 12.5821 13.1092 12.6634 13.0777 12.7393C13.0463 12.8152 13.0003 12.8841 12.9422 12.9422C12.8841 13.0003 12.8152 13.0463 12.7393 13.0777C12.6634 13.1092 12.5821 13.1253 12.5 13.1253C12.4179 13.1253 12.3366 13.1092 12.2607 13.0777C12.1848 13.0463 12.1159 13.0003 12.0578 12.9422L10 10.8836L7.94219 12.9422C7.88412 13.0003 7.81518 13.0463 7.73931 13.0777C7.66344 13.1092 7.58213 13.1253 7.5 13.1253C7.41788 13.1253 7.33656 13.1092 7.26069 13.0777C7.18482 13.0463 7.11588 13.0003 7.05782 12.9422C6.99975 12.8841 6.95368 12.8152 6.92226 12.7393C6.89083 12.6634 6.87466 12.5821 6.87466 12.5C6.87466 12.4179 6.89083 12.3366 6.92226 12.2607C6.95368 12.1848 6.99975 12.1159 7.05782 12.0578L9.11641 10L7.05782 7.94219C6.94054 7.82491 6.87466 7.66585 6.87466 7.5C6.87466 7.33415 6.94054 7.17509 7.05782 7.05781C7.17509 6.94054 7.33415 6.87465 7.5 6.87465C7.66586 6.87465 7.82492 6.94054 7.94219 7.05781L10 9.11641L12.0578 7.05781C12.1159 6.99974 12.1848 6.95368 12.2607 6.92225C12.3366 6.89083 12.4179 6.87465 12.5 6.87465C12.5821 6.87465 12.6634 6.89083 12.7393 6.92225C12.8152 6.95368 12.8841 6.99974 12.9422 7.05781C13.0003 7.11588 13.0463 7.18482 13.0777 7.26069C13.1092 7.33656 13.1254 7.41788 13.1254 7.5C13.1254 7.58212 13.1092 7.66344 13.0777 7.73931C13.0463 7.81518 13.0003 7.88412 12.9422 7.94219L10.8836 10L12.9422 12.0578Z" fill="#DC2626"/>
    </svg>
  )
}

// ─── Component list ───────────────────────────────────────────────────────────

const COMPONENTS = [
  'Accordion', 'Alert', 'Avatar', 'Badge', 'Bar Chart', 'Breadcrumb', 'Button', 'Button Group',
  'Calendar', 'Card', 'Checkbox',
  'Dialog', 'Dropdown Menu', 'Dropzone', 'Input', 'Input OTP', 'Kbd', 'Label', 'Line Chart', 'Popover', 'Progress',
  'Pagination', 'Radio Group', 'Rating', 'Select', 'Separator', 'Sheet', 'Sidebar', 'Skeleton', 'Slider',
  'Spinner', 'Switch', 'Table', 'Tabs', 'Textarea', 'Toast', 'Toggle', 'Tooltip',
]

// ─── Component variants ──────────────────────────────────────────────────────
// Maps each component to its primary variant dimension for variants preview mode.
// Components not listed here (Table, Charts, Calendar, Sidebar, etc.) fall back
// to single preview. Values must be valid prop values for that component.

const COMPONENT_VARIANTS: Record<string, { prop: string; values: (string | boolean | number)[] }> = {
  Accordion:      { prop: 'variant',        values: ['default', 'separated', 'bordered', 'ghost'] },
  Alert:          { prop: 'variant',        values: ['default', 'destructive', 'success', 'warning', 'info'] },
  Avatar:         { prop: 'size',           values: ['sm', 'default', 'lg', 'xl'] },
  Badge:          { prop: 'variant',        values: ['default', 'secondary', 'outline', 'destructive', 'success', 'warning', 'info'] },
  Breadcrumb:     { prop: 'separatorStyle', values: ['slash', 'chevron', 'dot'] },
  Dropzone:       { prop: 'variant',        values: ['default', 'active', 'success', 'error'] },
  'Input OTP':    { prop: 'slotStyle',      values: ['bordered', 'filled', 'underline'] },
  Kbd:            { prop: 'variant',        values: ['default', 'outline', 'ghost', 'solid'] },
  Button:         { prop: 'variant',        values: ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] },
  Pagination:     { prop: 'variant',        values: ['default', 'filled', 'minimal', 'rounded'] },
  Progress:       { prop: 'size',           values: ['sm', 'default', 'lg'] },
  'Radio Group':  { prop: 'orientation',    values: ['vertical', 'horizontal'] },
  Rating:         { prop: 'variant',        values: ['stars', 'emoji', 'thumbs'] },
  Select:         { prop: 'size',           values: ['sm', 'default', 'lg'] },
  Separator:      { prop: 'orientation',    values: ['horizontal', 'vertical'] },
  Skeleton:       { prop: 'preset',         values: ['text-lines', 'card', 'avatar-row', 'form'] },
  Spinner:        { prop: 'variant',        values: ['border', 'dots', 'bars', 'pulse'] },
  Switch:         { prop: 'checked',        values: [false, true] },
  Tabs:           { prop: 'variant',        values: ['default', 'underline', 'pill', 'bordered'] },
  Toggle:         { prop: 'variant',        values: ['default', 'outline'] },
  Tooltip:        { prop: 'side',           values: ['top', 'right', 'bottom', 'left'] },
}

// ─── Component States ─────────────────────────────────────────────────────────
// Maps component names to a list of interaction states. Each state overrides
// specific props to simulate how the component looks in that state.

type StateEntry = { label: string; propsOverride: Partial<ComponentProps> }

const COMPONENT_STATES: Record<string, StateEntry[]> = {
  Button: [
    { label: 'Default',     propsOverride: { variant: 'default' } },
    { label: 'Disabled',    propsOverride: { variant: 'default', disabled: true } },
    { label: 'Loading',     propsOverride: { variant: 'default', loading: true } },
    { label: 'Destructive', propsOverride: { variant: 'destructive' } },
    { label: 'Ghost',       propsOverride: { variant: 'ghost' } },
    { label: 'Outline',     propsOverride: { variant: 'outline' } },
  ],
  Badge: [
    { label: 'Default',     propsOverride: { variant: 'default' } },
    { label: 'Secondary',   propsOverride: { variant: 'secondary' } },
    { label: 'Outline',     propsOverride: { variant: 'outline' } },
    { label: 'Destructive', propsOverride: { variant: 'destructive' } },
    { label: 'Success',     propsOverride: { variant: 'success' } },
    { label: 'Warning',     propsOverride: { variant: 'warning' } },
    { label: 'Info',        propsOverride: { variant: 'info' } },
  ],
  Kbd: [
    { label: 'Default',  propsOverride: { variant: 'default',  pressed: false, disabled: false } },
    { label: 'Pressed',  propsOverride: { variant: 'default',  pressed: true  } },
    { label: 'Disabled', propsOverride: { variant: 'default',  disabled: true } },
    { label: 'Outline',  propsOverride: { variant: 'outline',  pressed: false } },
    { label: 'Ghost',    propsOverride: { variant: 'ghost',    pressed: false } },
    { label: 'Solid',    propsOverride: { variant: 'solid',    pressed: false } },
  ],
  Toggle: [
    { label: 'Off',          propsOverride: { pressed: false, variant: 'default' } },
    { label: 'On',           propsOverride: { pressed: true,  variant: 'default' } },
    { label: 'Outline Off',  propsOverride: { pressed: false, variant: 'outline' } },
    { label: 'Outline On',   propsOverride: { pressed: true,  variant: 'outline' } },
  ],
  Spinner: [
    { label: 'Border', propsOverride: { variant: 'border' } },
    { label: 'Dots',   propsOverride: { variant: 'dots'   } },
    { label: 'Bars',   propsOverride: { variant: 'bars'   } },
    { label: 'Pulse',  propsOverride: { variant: 'pulse'  } },
  ],
  Switch: [
    { label: 'Off',           propsOverride: { checked: false } },
    { label: 'On',            propsOverride: { checked: true } },
    { label: 'Off / Disabled', propsOverride: { checked: false, disabled: true } },
    { label: 'On / Disabled',  propsOverride: { checked: true,  disabled: true } },
  ],
  Checkbox: [
    { label: 'Unchecked',     propsOverride: { checked: false, indeterminate: false } },
    { label: 'Checked',       propsOverride: { checked: true,  indeterminate: false } },
    { label: 'Indeterminate', propsOverride: { checked: false, indeterminate: true  } },
    { label: 'Disabled',      propsOverride: { checked: false, disabled: true } },
    { label: 'Checked / Disabled', propsOverride: { checked: true, disabled: true } },
  ],
  Accordion: [
    { label: 'Default',   propsOverride: { variant: 'default'   } },
    { label: 'Separated', propsOverride: { variant: 'separated' } },
    { label: 'Bordered',  propsOverride: { variant: 'bordered'  } },
    { label: 'Ghost',     propsOverride: { variant: 'ghost'     } },
  ],
  Dropzone: [
    { label: 'Idle',    propsOverride: { variant: 'default' } },
    { label: 'Active',  propsOverride: { variant: 'active'  } },
    { label: 'Success', propsOverride: { variant: 'success' } },
    { label: 'Error',   propsOverride: { variant: 'error'   } },
  ],
  'Input OTP': [
    { label: 'Empty',     propsOverride: { previewValue: ''       } },
    { label: 'Partial',   propsOverride: { previewValue: '123'    } },
    { label: 'Complete',  propsOverride: { previewValue: '123456' } },
    { label: 'Disabled',  propsOverride: { disabled: true         } },
  ],
  Pagination: [
    { label: 'Default',  propsOverride: { variant: 'default'  } },
    { label: 'Filled',   propsOverride: { variant: 'filled'   } },
    { label: 'Minimal',  propsOverride: { variant: 'minimal'  } },
    { label: 'Rounded',  propsOverride: { variant: 'rounded'  } },
  ],
  'Radio Group': [
    { label: 'Option A selected', propsOverride: { defaultValue: 'option-a' } },
    { label: 'Option B selected', propsOverride: { defaultValue: 'option-b' } },
    { label: 'Horizontal',        propsOverride: { orientation: 'horizontal' } },
  ],
  Select: [
    { label: 'Default', propsOverride: {} },
    { label: 'Small',   propsOverride: { size: 'sm' } },
    { label: 'Large',   propsOverride: { size: 'lg' } },
    { label: 'Disabled', propsOverride: { disabled: true } },
  ],
  Tabs: [
    { label: 'Default',   propsOverride: { variant: 'default' } },
    { label: 'Underline', propsOverride: { variant: 'underline' } },
    { label: 'Pill',      propsOverride: { variant: 'pill' } },
    { label: 'Bordered',  propsOverride: { variant: 'bordered' } },
  ],
}

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
  if (component === 'Accordion') {
    const itemCount = (props.itemCount as number) ?? 3
    const items = Array.from({ length: itemCount }, (_, i) => ({
      q: (props[`item${i}Title`] as string) ?? `Section ${i + 1}`,
      a: (props[`item${i}Content`] as string) ?? 'Content goes here.',
    }))
    const itemsJSX = items.map((it, i) =>
      `  <AccordionItem value="item-${i + 1}">\n    <AccordionTrigger>${it.q}</AccordionTrigger>\n    <AccordionContent>${it.a}</AccordionContent>\n  </AccordionItem>`
    ).join('\n')
    return {
      full: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"\n\nexport function MyAccordion() {\n  return (\n    <Accordion type="single" collapsible className="w-full">\n${itemsJSX}\n    </Accordion>\n  )\n}`,
      usage: `<Accordion type="single" collapsible>\n${itemsJSX}\n</Accordion>`,
    }
  }
  if (component === 'Dropzone') {
    const variant = (props.variant as string) ?? 'default'
    const title = (props.title as string) ?? 'Drop files here'
    const description = (props.description as string) ?? 'or click to browse'
    const acceptedTypes = (props.acceptedTypes as string) ?? 'PNG, JPG, PDF'
    const maxSize = (props.maxSize as string) ?? '10MB'
    const p = variant !== 'default' ? ` data-variant="${variant}"` : ''
    return {
      full: `// Custom Dropzone component (no shadcn dep)\nexport function MyDropzone() {\n  return (\n    <div${p}\n      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 text-center cursor-pointer hover:bg-muted/40 transition-colors"\n    >\n      <div className="text-sm font-medium">${title}</div>\n      <div className="text-xs text-muted-foreground">${description}</div>\n      <div className="text-xs text-muted-foreground">${acceptedTypes} · Max ${maxSize}</div>\n    </div>\n  )\n}`,
      usage: `<Dropzone title="${title}" description="${description}" accept="${acceptedTypes}" maxSize="${maxSize}" />`,
    }
  }
  if (component === 'Input OTP') {
    const length = (props.length as number) ?? 6
    const grouped = (props.grouped as boolean) ?? false
    const half = Math.floor(length / 2)
    const slots = (n: number, offset = 0) =>
      Array.from({ length: n }, (_, i) => `      <InputOTPSlot index={${offset + i}} />`).join('\n')
    const inner = grouped
      ? `    <InputOTPGroup>\n${slots(half)}\n    </InputOTPGroup>\n    <InputOTPSeparator />\n    <InputOTPGroup>\n${slots(length - half, half)}\n    </InputOTPGroup>`
      : `    <InputOTPGroup>\n${slots(length)}\n    </InputOTPGroup>`
    return {
      full: `import { InputOTP, InputOTPGroup, InputOTPSlot${grouped ? ', InputOTPSeparator' : ''} } from "@/components/ui/input-otp"\n\nexport function MyInputOTP() {\n  return (\n    <InputOTP maxLength={${length}}>\n${inner}\n    </InputOTP>\n  )\n}`,
      usage: `<InputOTP maxLength={${length}}>...</InputOTP>`,
    }
  }
  if (component === 'Kbd') {
    const variant = (props.variant as string) ?? 'default'
    const kbdSize = (props.size as string) ?? 'default'
    const key1 = (props.key1 as string) ?? '⌘'
    const key2 = (props.key2 as string) ?? 'K'
    const key3 = (props.key3 as string) ?? ''
    const keys = [key1, key2, key3].filter(Boolean)
    const parts: string[] = []
    if (variant !== 'default') parts.push(`variant="${variant}"`)
    if (kbdSize !== 'default') parts.push(`size="${kbdSize}"`)
    const p = parts.length ? ' ' + parts.join(' ') : ''
    const inner = keys.length > 1
      ? `<div className="flex items-center gap-1.5">\n      ${keys.map((k, i) => `${i > 0 ? '<span className="text-xs text-muted-foreground">+</span>\n      ' : ''}<Kbd${p}>${k}</Kbd>`).join('\n      ')}\n    </div>`
      : `<Kbd${p}>${key1}</Kbd>`
    return {
      full: `import { Kbd } from "@/components/ui/kbd"\n\nexport function MyKbd() {\n  return (\n    ${inner}\n  )\n}`,
      usage: keys.length > 1
        ? `<Kbd${p}>${key1}</Kbd> <span>+</span> <Kbd${p}>${key2}</Kbd>`
        : `<Kbd${p}>${key1}</Kbd>`,
    }
  }
  if (component === 'Pagination') {
    const totalPages = (props.totalPages as number) ?? 5
    const activePage = (props.activePage as number) ?? 3
    const showPrevNext = (props.showPrevNext as boolean) ?? true
    const prevLabel = (props.prevLabel as string) ?? 'Previous'
    const nextLabel = (props.nextLabel as string) ?? 'Next'
    const items = Array.from({ length: totalPages }, (_, i) => i + 1)
      .map((p) => `    <PaginationItem>\n      <PaginationLink${p === activePage ? ' isActive' : ''} href="#">${p}</PaginationLink>\n    </PaginationItem>`)
      .join('\n')
    return {
      full: `import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"\n\nexport function MyPagination() {\n  return (\n    <Pagination>\n      <PaginationContent>\n${showPrevNext ? `        <PaginationItem><PaginationPrevious href="#" text="${prevLabel}" /></PaginationItem>\n` : ''}${items}\n${showPrevNext ? `        <PaginationItem><PaginationNext href="#" text="${nextLabel}" /></PaginationItem>` : ''}\n      </PaginationContent>\n    </Pagination>\n  )\n}`,
      usage: `<Pagination>...</Pagination>`,
    }
  }
  if (component === 'Spinner') {
    const size = (props.size as string) ?? 'md'
    const label = (props.label as string) ?? ''
    const sizeMap: Record<string, string> = { xs: '12px', sm: '16px', md: '24px', lg: '32px', xl: '48px' }
    const dim = sizeMap[size] ?? sizeMap.md
    return {
      full: `// Spinner — no external dependency\nexport function MySpinner() {\n  return (\n    <div\n      role="status"\n      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"\n      style={{ width: '${dim}', height: '${dim}' }}\n      aria-label="${label || 'Loading'}"\n    />\n  )\n}`,
      usage: `<div role="status" className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent" style={{ width: '${dim}', height: '${dim}' }} />`,
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
  if (component === 'Rating') {
    const variant = (props.variant as string) ?? 'stars'
    if (variant === 'stars') {
      const iconType = (props.iconType as string) ?? 'star'
      const starCount = (props.starCount as number) ?? 5
      const activeCount = (props.activeCount as number) ?? 3
      const activeColor = (props.activeColor as string) || '#2563EB'
      return {
        full: `// Custom Rating component\nfunction StarRating({ count = ${starCount}, value = ${activeCount}, color = "${activeColor}" }) {\n  return (\n    <div className="flex items-center gap-1">\n      {Array.from({ length: count }, (_, i) => (\n        <svg key={i} width="22" height="22" viewBox="0 0 24 24"\n          fill={i < value ? color : "none"}\n          stroke={i < value ? color : "currentColor"}\n          strokeWidth="1.5" className="text-muted-foreground cursor-pointer">\n          ${iconType === 'heart' ? '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />' : '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />'}\n        </svg>\n      ))}\n    </div>\n  )\n}`,
        usage: `<StarRating count={${starCount}} value={${activeCount}} color="${activeColor}" />`,
      }
    }
    if (variant === 'emoji') {
      const question = (props.question as string) ?? 'Did this answer your question?'
      const e1 = (props.emoji1 as string) ?? '😞'
      const e2 = (props.emoji2 as string) ?? '😐'
      const e3 = (props.emoji3 as string) ?? '🤩'
      return {
        full: `// Custom Emoji Rating\nexport function EmojiRating() {\n  return (\n    <div className="flex flex-col items-center gap-4">\n      <p className="text-sm font-medium">${question}</p>\n      <div className="flex items-center gap-3">\n        {["${e1}", "${e2}", "${e3}"].map((e, i) => (\n          <button key={i} className="text-3xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-muted transition-colors">{e}</button>\n        ))}\n      </div>\n    </div>\n  )\n}`,
        usage: `<EmojiRating />`,
      }
    }
    // thumbs
    const question = (props.question as string) ?? 'Was this page helpful?'
    const yesLabel = (props.yesLabel as string) ?? 'Yes'
    const noLabel = (props.noLabel as string) ?? 'No'
    return {
      full: `// Custom Thumbs Rating\nexport function ThumbsRating() {\n  return (\n    <div className="flex items-center gap-4 flex-wrap">\n      <p className="text-sm font-medium">${question}</p>\n      <div className="flex items-center gap-2">\n        <Button variant="outline" size="sm"><ThumbsUp size={14} className="mr-1.5" />${yesLabel}</Button>\n        <Button variant="outline" size="sm"><ThumbsDown size={14} className="mr-1.5" />${noLabel}</Button>\n      </div>\n    </div>\n  )\n}`,
      usage: `<ThumbsRating />`,
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

// ─── Token color picker (floating draggable panel) ────────────────────────────

function TokenColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const activeTokenKey = TOKEN_KEYS.find(k => `var(${TOKEN_CSS_VARS[k]})` === value) ?? null
  const activeTailwind = activeTokenKey === null
    ? (() => {
        for (const family of TAILWIND_PALETTE) {
          const shade = family.shades.find(s => s.hex === value)
          if (shade) return { family: family.name, shade: shade.shade, hex: shade.hex }
        }
        return null
      })()
    : null

  const displayLabel = activeTokenKey
    ? TOKEN_LABELS[activeTokenKey]
    : activeTailwind
    ? `${activeTailwind.family} ${activeTailwind.shade}`
    : value || 'Select...'

  const displayColor = activeTokenKey
    ? `var(${TOKEN_CSS_VARS[activeTokenKey]})`
    : activeTailwind?.hex ?? (value || 'transparent')

  const q = query.trim().toLowerCase()
  const filteredTokenGroups = q
    ? TOKEN_GROUPS.map(g => ({ ...g, keys: g.keys.filter(k => TOKEN_LABELS[k].toLowerCase().includes(q)) })).filter(g => g.keys.length > 0)
    : TOKEN_GROUPS
  const filteredTailwind = q
    ? TAILWIND_PALETTE.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.shades.some(s => `${f.name} ${s.shade}`.toLowerCase().includes(q))
      )
    : TAILWIND_PALETTE

  function openPanel() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const panelW = 288
      const x = Math.max(8, rect.left - panelW - 8)
      setPos({ x, y: rect.top })
    }
    setOpen(true)
  }

  function onDragStart(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const startX = e.clientX - pos.x
    const startY = e.clientY - pos.y
    function onMove(ev: MouseEvent) { setPos({ x: ev.clientX - startX, y: ev.clientY - startY }) }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(v: string) { onChange(v); setOpen(false); setQuery('') }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        className="flex-1 h-7 flex items-center gap-1.5 px-2 text-xs rounded-md border border-border bg-muted hover:bg-muted/70 transition-colors cursor-pointer min-w-0 overflow-hidden"
      >
        <div className="w-3.5 h-3.5 rounded-sm shrink-0 border border-border/40" style={{ backgroundColor: displayColor }} />
        <span className="truncate text-left flex-1 text-foreground/80">{displayLabel}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{ left: pos.x, top: pos.y, width: 288 }}
          className="fixed z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden flex flex-col"
        >
          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className="flex justify-center items-center h-6 bg-muted/50 cursor-grab active:cursor-grabbing select-none border-b border-border/40 shrink-0"
          >
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-0.5 h-2.5 rounded-full bg-muted-foreground/30" />
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="p-2 shrink-0">
            <Input
              placeholder="Search tokens & colors..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-80">
            {/* Design Tokens */}
            {filteredTokenGroups.length > 0 && (
              <div className="px-2 pb-1">
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Design Tokens</p>
                {filteredTokenGroups.map(group => (
                  <div key={group.label}>
                    <p className="px-1 pt-2 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{group.label}</p>
                    {group.keys.map(key => (
                      <button
                        key={key}
                        onClick={() => select(`var(${TOKEN_CSS_VARS[key]})`)}
                        className={cn(
                          'flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs cursor-pointer transition-colors hover:bg-muted text-left',
                          activeTokenKey === key && 'bg-accent/15 font-medium',
                        )}
                      >
                        <div className="w-4 h-4 rounded-sm shrink-0 border border-border/40" style={{ backgroundColor: `var(${TOKEN_CSS_VARS[key]})` }} />
                        {TOKEN_LABELS[key]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Tailwind Colors */}
            {filteredTailwind.length > 0 && (
              <div className="px-2 pt-2 pb-3">
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Tailwind Colors</p>
                {filteredTailwind.map(family => (
                  <div key={family.name} className="flex items-center gap-2 py-0.5 px-1">
                    <span className="text-[10px] text-muted-foreground w-12 shrink-0">{family.name}</span>
                    <div className="flex gap-0.5 flex-1">
                      {family.shades.map(({ shade, hex }) => (
                        <button
                          key={shade}
                          title={`${family.name} ${shade} · ${hex}`}
                          onClick={() => select(hex)}
                          className={cn(
                            'flex-1 h-4 rounded-sm cursor-pointer transition-all hover:scale-y-125 hover:rounded-none',
                            activeTailwind?.family === family.name && activeTailwind?.shade === shade && 'ring-1 ring-foreground ring-offset-1',
                          )}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredTokenGroups.length === 0 && filteredTailwind.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No results for "{query}"</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Per-component default colors ─────────────────────────────────────────────
// CSS var references resolve against the live theme, so swatches update automatically.

const BUTTON_VARIANT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default:     { bg: 'var(--primary)',     text: 'var(--primary-foreground)',     border: 'transparent' },
  destructive: { bg: 'var(--destructive)', text: 'var(--destructive-foreground)', border: 'transparent' },
  outline:     { bg: 'transparent',        text: 'var(--foreground)',             border: 'var(--border)' },
  secondary:   { bg: 'var(--secondary)',   text: 'var(--secondary-foreground)',   border: 'transparent' },
  ghost:       { bg: 'transparent',        text: 'var(--foreground)',             border: 'transparent' },
  link:        { bg: 'transparent',        text: 'var(--primary)',                border: 'transparent' },
}
const BADGE_VARIANT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default:     { bg: 'var(--primary)',     text: 'var(--primary-foreground)', border: 'transparent' },
  secondary:   { bg: 'var(--secondary)',   text: 'var(--secondary-foreground)', border: 'transparent' },
  destructive: { bg: 'var(--destructive)', text: 'var(--destructive-foreground)', border: 'transparent' },
  outline:     { bg: 'transparent',        text: 'var(--foreground)',         border: 'var(--border)' },
  success:     { bg: '#dcfce7',            text: '#166534',                   border: '#bbf7d0' },
  warning:     { bg: '#fef3c7',            text: '#92400e',                   border: '#fde68a' },
  info:        { bg: '#dbeafe',            text: '#1e40af',                   border: '#bfdbfe' },
}
const ALERT_VARIANT_COLORS: Record<string, { bg: string; text: string; border: string; desc: string }> = {
  default:     { bg: 'var(--background)',  text: 'var(--foreground)',  border: 'var(--border)',       desc: 'var(--muted-foreground)' },
  destructive: { bg: 'transparent',        text: 'var(--destructive)', border: 'var(--destructive)', desc: 'var(--destructive)' },
}
const ACCORDION_VARIANT_COLORS: Record<string, { bg: string; trigger: string; content: string; border: string }> = {
  default:   { bg: 'transparent', trigger: 'var(--foreground)', content: 'var(--muted-foreground)', border: 'var(--border)' },
  separated: { bg: 'transparent', trigger: 'var(--foreground)', content: 'var(--muted-foreground)', border: 'var(--border)' },
  bordered:  { bg: 'transparent', trigger: 'var(--foreground)', content: 'var(--muted-foreground)', border: 'var(--border)' },
  ghost:     { bg: 'transparent', trigger: 'var(--foreground)', content: 'var(--muted-foreground)', border: 'transparent' },
}
const DROPZONE_VARIANT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: 'transparent',        text: 'var(--foreground)', border: 'var(--border)' },
  active:  { bg: 'var(--primary)',      text: 'var(--foreground)', border: 'var(--primary)' },
  success: { bg: '#16a34a',             text: '#ffffff',           border: '#16a34a' },
  error:   { bg: 'var(--destructive)',  text: 'var(--foreground)', border: 'var(--destructive)' },
}
const SPINNER_VARIANT_COLORS: Record<string, { spinner: string; track: string; label: string }> = {
  border: { spinner: 'var(--primary)',    track: 'var(--muted)',    label: 'var(--foreground)' },
  dots:   { spinner: 'var(--foreground)', track: 'transparent',     label: 'var(--foreground)' },
  bars:   { spinner: 'var(--foreground)', track: 'transparent',     label: 'var(--foreground)' },
  pulse:  { spinner: 'var(--primary)',    track: 'transparent',     label: 'var(--foreground)' },
}
const PAGINATION_VARIANT_COLORS: Record<string, { activeBg: string; activeText: string; text: string }> = {
  default: { activeBg: 'var(--background)', activeText: 'var(--foreground)',         text: 'var(--muted-foreground)' },
  filled:  { activeBg: 'var(--primary)',    activeText: 'var(--primary-foreground)', text: 'var(--muted-foreground)' },
  minimal: { activeBg: 'transparent',       activeText: 'var(--primary)',            text: 'var(--muted-foreground)' },
  rounded: { activeBg: 'var(--primary)',    activeText: 'var(--primary-foreground)', text: 'var(--muted-foreground)' },
}

// ─── Token/Custom color binding control ───────────────────────────────────────
// Lets the user choose between a semantic token (var(--primary) etc.) or a raw
// custom color. Mode is derived from the stored value — no separate state needed.
// defaultColor = the actual color the component renders when no override is set.

function TokenColorControl({
  label,
  value,
  onChange,
  paletteColors,
  defaultColor,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  paletteColors: string[]
  defaultColor?: string
}) {
  const activeTokenKey = TOKEN_KEYS.find(k => `var(${TOKEN_CSS_VARS[k]})` === value) ?? null
  const isTailwind = activeTokenKey === null && TAILWIND_PALETTE.some(f => f.shades.some(s => s.hex === value))
  const mode: 'token' | 'custom' = (activeTokenKey !== null || isTailwind) ? 'token' : 'custom'

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
          {(['token', 'custom'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { if (m === 'token' && mode !== 'token') onChange(`var(${TOKEN_CSS_VARS['primary']})`); else if (m === 'custom' && mode !== 'custom') onChange('') }}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded cursor-pointer capitalize transition-all',
                mode === m ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >{m}</button>
          ))}
        </div>
      </div>
      {mode === 'token' ? (
        <TokenColorPicker value={value} onChange={onChange} />
      ) : (
        <div className="flex items-center gap-2">
          <ColorPicker value={value} onChange={onChange} paletteColors={paletteColors} placeholderColor={defaultColor} />
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[80px]">
            {value || <span className="text-muted-foreground/40 not-italic">Default</span>}
          </span>
        </div>
      )}
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
          <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
            {(['px', 'rem'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded cursor-pointer transition-all',
                  unit === u ? 'bg-background text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {u}
              </button>
            ))}
          </div>
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

  const boxCls = cn(
    'flex items-center h-7 bg-muted border border-border rounded-md overflow-hidden',
    'focus-within:border-ring',
  )
  const labelCls = 'text-[10px] font-medium text-muted-foreground/60 pl-2 pr-1 select-none shrink-0'
  const inputCls = cn(
    'flex-1 h-full text-xs font-mono text-right bg-transparent pr-2',
    'outline-none',
    '[appearance:textfield]',
    '[&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:appearance-none',
  )

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <button
          onClick={() => setLinked(!linked)}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors',
            linked ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/70',
          )}
          title={linked ? 'Unlink sides' : 'Link all sides'}
        >
          {linked
            ? <Link size={11} strokeWidth={2} />
            : <Link2Off size={11} strokeWidth={2} />
          }
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className={boxCls}>
          <span className={labelCls}>T</span>
          <input type="number" min={0} max={999} value={value.top} onChange={(e) => update('top', e.target.value)} className={inputCls} />
        </div>
        <div className={boxCls}>
          <span className={labelCls}>R</span>
          <input type="number" min={0} max={999} value={value.right} onChange={(e) => update('right', e.target.value)} className={inputCls} />
        </div>
        <div className={boxCls}>
          <span className={labelCls}>B</span>
          <input type="number" min={0} max={999} value={value.bottom} onChange={(e) => update('bottom', e.target.value)} className={inputCls} />
        </div>
        <div className={boxCls}>
          <span className={labelCls}>L</span>
          <input type="number" min={0} max={999} value={value.left} onChange={(e) => update('left', e.target.value)} className={inputCls} />
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

function ButtonSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        {(() => { const vc = BUTTON_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? BUTTON_VARIANT_COLORS.default; return (<>
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          defaultColor={vc.bg}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
          defaultColor={vc.text}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          defaultColor={vc.border}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
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

const BADGE_SIZE_PRESETS: Record<string, { fontSize: number; padding: PaddingValue; height: number }> = {
  sm: { fontSize: 10, padding: { top: 1, right: 8,  bottom: 1, left: 8  }, height: 18 },
  md: { fontSize: 12, padding: { top: 2, right: 10, bottom: 2, left: 10 }, height: 20 },
  lg: { fontSize: 14, padding: { top: 4, right: 14, bottom: 4, left: 14 }, height: 26 },
}

function BadgeSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const size = (props.size as string) ?? 'md'
  const fontWeight = (props.fontWeight as string) ?? '500'

  function applySize(s: string) {
    const preset = BADGE_SIZE_PRESETS[s]
    if (!preset) return
    updateProp('size', s)
    updateProp('fontSize', preset.fontSize)
    updateProp('padding', preset.padding)
  }

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'info'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => applySize(s)} />
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
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-xs text-muted-foreground">Leading icon</span>
          <IconPicker
            value={(props.leadingIcon as string) ?? null}
            onChange={(v) => updateProp('leadingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
        </div>
        <div className="flex items-center justify-between px-4 pt-1 pb-2">
          <span className="text-xs text-muted-foreground">Trailing icon</span>
          <IconPicker
            value={(props.trailingIcon as string) ?? null}
            onChange={(v) => updateProp('trailingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = BADGE_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? BADGE_VARIANT_COLORS.default; return (<>
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          defaultColor={vc.bg}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
          defaultColor={vc.text}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          defaultColor={vc.border}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
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

function InputSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
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
          value={(props.padding as PaddingValue) ?? { top: 4, right: 10, bottom: 4, left: 10 }}
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

function InputOTPSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const slotStyle = (props.slotStyle as string) ?? 'bordered'
  const slotSize = (props.slotSize as string) ?? 'md'
  const length = (props.length as number) ?? 6

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Slot style</p>
          <div className="flex gap-1.5 flex-wrap">
            {['bordered', 'filled', 'underline'].map((s) => (
              <PillButton key={s} label={s} active={slotStyle === s} onClick={() => updateProp('slotStyle', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Slot size</p>
          <div className="flex gap-1.5">
            {['sm', 'md', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={slotSize === s} onClick={() => updateProp('slotSize', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Structure">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Length</p>
          <div className="flex gap-1.5">
            {[4, 5, 6, 8].map((n) => (
              <PillButton key={n} label={String(n)} active={length === n} onClick={() => updateProp('length', n)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Split into groups</span>
          <Switch checked={(props.grouped as boolean) ?? false} onCheckedChange={(v) => updateProp('grouped', v)} />
        </div>
      </InspectorSection>

      <InspectorSection title="Preview value">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Characters shown</p>
          <Input
            value={(props.previewValue as string) ?? ''}
            maxLength={length}
            onChange={(e) => updateProp('previewValue', e.target.value)}
            className="h-7 text-xs rounded-md font-mono"
            placeholder="e.g. 123456"
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <TokenColorControl
          label="Slot background"
          value={(props.slotBg as string) ?? ''}
          onChange={(v) => updateProp('slotBg', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Slot border"
          value={(props.slotBorder as string) ?? ''}
          onChange={(v) => updateProp('slotBorder', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>

      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch checked={(props.disabled as boolean) ?? false} onCheckedChange={(v) => updateProp('disabled', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Mask characters</span>
          <Switch checked={(props.mask as boolean) ?? false} onCheckedChange={(v) => updateProp('mask', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Error state</span>
          <Switch checked={(props.errorState as boolean) ?? false} onCheckedChange={(v) => updateProp('errorState', v)} />
        </div>
        {(props.errorState as boolean) && (
          <div className="px-4 pt-1 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Error message</p>
            <Input
              value={(props.errorMessage as string) ?? 'Invalid verification code.'}
              onChange={(e) => updateProp('errorMessage', e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
        )}
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Slot radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

const KBD_VARIANT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: 'var(--muted)',       text: 'var(--muted-foreground)', border: 'var(--border)' },
  outline: { bg: 'var(--background)',  text: 'var(--foreground)',       border: 'var(--border)' },
  ghost:   { bg: 'transparent',        text: 'var(--muted-foreground)', border: 'transparent'   },
  solid:   { bg: 'var(--foreground)',  text: 'var(--background)',       border: 'transparent'   },
}

function KbdSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const kbdSize = (props.size as string) ?? 'default'
  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />
      <InspectorSection title="Variant">
        <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-2">
          {['default', 'outline', 'ghost', 'solid'].map((v) => (
            <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Size">
        <div className="flex gap-1.5 px-4 pt-2 pb-2">
          {['sm', 'default', 'lg'].map((s) => (
            <PillButton key={s} label={s} active={kbdSize === s} onClick={() => updateProp('size', s)} />
          ))}
        </div>
      </InspectorSection>
      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-3 flex flex-col gap-2">
          {(['key1', 'key2', 'key3'] as const).map((k, i) => {
            const defaults = ['⌘', 'K', '']
            return (
              <div key={k}>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Key {i + 1}{i > 0 && <span className="text-muted-foreground/50"> (optional)</span>}
                </p>
                <Input
                  value={(props[k] as string) ?? defaults[i]}
                  onChange={(e) => updateProp(k, e.target.value)}
                  className="h-7 text-xs rounded-md font-mono"
                  placeholder={i === 2 ? 'leave empty to hide' : defaults[i]}
                />
              </div>
            )
          })}
        </div>
      </InspectorSection>
      <InspectorSection title="States">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Pressed</span>
          <Switch
            checked={(props.pressed as boolean) ?? false}
            onCheckedChange={(v) => updateProp('pressed', v)}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Disabled</span>
          <Switch
            checked={(props.disabled as boolean) ?? false}
            onCheckedChange={(v) => updateProp('disabled', v)}
          />
        </div>
      </InspectorSection>
      <InspectorSection title="Colors">
        {(() => {
          const vc = KBD_VARIANT_COLORS[variant] ?? KBD_VARIANT_COLORS.default
          return (
            <>
              <TokenColorControl label="Background" value={(props.bgColor as string) ?? ''} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} defaultColor={vc.bg} />
              <TokenColorControl label="Text"       value={(props.textColor as string) ?? ''} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} defaultColor={vc.text} />
              <TokenColorControl label="Border"     value={(props.borderColor as string) ?? ''} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} defaultColor={vc.border} />
            </>
          )
        })()}
      </InspectorSection>
      <InspectorSection title="Typography">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Font size</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={8} max={24}
              value={(props.fontSize as number) ?? 12}
              onChange={(e) => updateProp('fontSize', parseInt(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Spacing">
        <PaddingControl
          label="Padding"
          value={(props.padding as PaddingValue) ?? { top: 0, right: 6, bottom: 0, left: 6 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Key radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

function CardSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
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
          value={(props.padding as PaddingValue) ?? { top: 16, right: 0, bottom: 16, left: 0 }}
          onChange={(v) => updateProp('padding', v)}
        />
      </InspectorSection>
    </>
  )
}

function AccordionSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const itemCount = (props.itemCount as number) ?? 3
  const chevronSide = (props.chevronSide as string) ?? 'right'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'separated', 'bordered', 'ghost'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Chevron side</p>
          <div className="flex gap-1.5">
            {['left', 'right'].map((s) => (
              <PillButton key={s} label={s} active={chevronSide === s} onClick={() => updateProp('chevronSide', s)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Allow multiple open</span>
          <Switch checked={(props.multiple as boolean) ?? false} onCheckedChange={(v) => updateProp('multiple', v)} />
        </div>
      </InspectorSection>

      <InspectorSection title="Items">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Item count</p>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5].map((n) => (
              <PillButton key={n} label={String(n)} active={itemCount === n} onClick={() => updateProp('itemCount', n)} />
            ))}
          </div>
        </div>
        {Array.from({ length: itemCount }, (_, i) => (
          <div key={i} className="px-4 pt-1 pb-2 border-t border-border/40 mt-1">
            <p className="text-xs text-muted-foreground mb-1.5 mt-1.5">Item {i + 1} title</p>
            <Input
              value={(props[`item${i}Title`] as string) ?? `Section ${i + 1}`}
              onChange={(e) => updateProp(`item${i}Title`, e.target.value)}
              className="h-7 text-xs rounded-md mb-1.5"
            />
            <p className="text-xs text-muted-foreground mb-1.5">Item {i + 1} content</p>
            <Input
              value={(props[`item${i}Content`] as string) ?? 'Content goes here.'}
              onChange={(e) => updateProp(`item${i}Content`, e.target.value)}
              className="h-7 text-xs rounded-md mb-2"
            />
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Leading icon</span>
              <IconPicker
                value={(props[`item${i}LeadingIcon`] as string) ?? null}
                onChange={(v) => updateProp(`item${i}LeadingIcon`, v ?? undefined)}
                placeholder="Add icon..."
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Trailing icon</span>
              <IconPicker
                value={(props[`item${i}TrailingIcon`] as string) ?? null}
                onChange={(v) => updateProp(`item${i}TrailingIcon`, v ?? undefined)}
                placeholder="Add icon..."
              />
            </div>
          </div>
        ))}
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = ACCORDION_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? ACCORDION_VARIANT_COLORS.default; return (<>
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          defaultColor={vc.bg}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Trigger text"
          value={(props.triggerColor as string) ?? ''}
          defaultColor={vc.trigger}
          onChange={(v) => updateProp('triggerColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Content text"
          value={(props.contentColor as string) ?? ''}
          defaultColor={vc.content}
          onChange={(v) => updateProp('contentColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          defaultColor={vc.border}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Item radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

function AlertSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'destructive', 'success', 'warning', 'info'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = ALERT_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? ALERT_VARIANT_COLORS.default; return (<>
        <TokenColorControl label="Background" value={(props.bgColor as string) ?? ''} defaultColor={vc.bg} onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Text color" value={(props.textColor as string) ?? ''} defaultColor={vc.text} onChange={(v) => updateProp('textColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Border color" value={(props.borderColor as string) ?? ''} defaultColor={vc.border} onChange={(v) => updateProp('borderColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Description" value={(props.descriptionColor as string) ?? ''} defaultColor={vc.desc} onChange={(v) => updateProp('descriptionColor', v)} paletteColors={paletteColors} />
        </>) })()}
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
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Trailing icon</span>
          <IconPicker
            value={(props.trailingIcon as string) ?? null}
            onChange={(v) => updateProp('trailingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
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

function AvatarSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>

      <InspectorSection title="Border">
        <TokenColorControl
          label="Border color"
          value={(props.borderColor as string) ?? ''}
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

function SpinnerSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'border'
  const size    = (props.size    as string) ?? 'md'
  const speed   = (props.speed   as string) ?? 'normal'
  const labelPos = (props.labelPosition as string) ?? 'bottom'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['border', 'dots', 'bars', 'pulse'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['xs', 'sm', 'md', 'lg', 'xl'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Speed</p>
          <div className="flex gap-1.5">
            {['slow', 'normal', 'fast'].map((s) => (
              <PillButton key={s} label={s} active={speed === s} onClick={() => updateProp('speed', s)} />
            ))}
          </div>
        </div>
        {variant === 'border' && (
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-muted-foreground">Thickness (px)</span>
            <input
              type="number" min={1} max={8} step={1}
              value={(props.thickness as number) ?? 2}
              onChange={(e) => updateProp('thickness', parseInt(e.target.value))}
              className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none focus:border-ring text-right"
            />
          </div>
        )}
      </InspectorSection>

      <InspectorSection title="Label">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Label text</p>
          <Input
            value={(props.label as string) ?? ''}
            onChange={(e) => updateProp('label', e.target.value)}
            className="h-7 text-xs rounded-md"
            placeholder="e.g. Loading…"
          />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Label position</p>
          <div className="flex gap-1.5">
            {['bottom', 'right'].map((p) => (
              <PillButton key={p} label={p} active={labelPos === p} onClick={() => updateProp('labelPosition', p)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = SPINNER_VARIANT_COLORS[(props.variant as string) ?? 'border'] ?? SPINNER_VARIANT_COLORS.border; return (<>
        <TokenColorControl
          label="Spinner color"
          value={(props.color as string) ?? ''}
          defaultColor={vc.spinner}
          onChange={(v) => updateProp('color', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Track color"
          value={(props.trackColor as string) ?? ''}
          defaultColor={vc.track}
          onChange={(v) => updateProp('trackColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Label color"
          value={(props.labelColor as string) ?? ''}
          defaultColor={vc.label}
          onChange={(v) => updateProp('labelColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
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

function TabsSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl
          label="Active tab"
          value={(props.activeColor as string) ?? ''}
          onChange={(v) => updateProp('activeColor', v)}
          paletteColors={paletteColors}
        />
      </InspectorSection>
      <InspectorSection title="Spacing">
        <PaddingControl
          label="Tab padding"
          value={(props.tabPadding as PaddingValue) ?? { top: 2, right: 6, bottom: 2, left: 6 }}
          onChange={(v) => updateProp('tabPadding', v)}
        />
        <PaddingControl
          label="Content padding"
          value={(props.contentPadding as PaddingValue) ?? { top: 8, right: 0, bottom: 0, left: 0 }}
          onChange={(v) => updateProp('contentPadding', v)}
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
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
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
          value={(props.padding as PaddingValue) ?? { top: 8, right: 10, bottom: 8, left: 10 }}
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

function DropzoneSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant = (props.variant as string) ?? 'default'
  const borderStyle = (props.borderStyle as string) ?? 'dashed'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'active', 'success', 'error'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Border style</p>
          <div className="flex gap-1.5">
            {['dashed', 'solid', 'dotted'].map((s) => (
              <PillButton key={s} label={s} active={borderStyle === s} onClick={() => updateProp('borderStyle', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Icon">
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <span className="text-xs text-muted-foreground">Upload icon</span>
          <IconPicker
            value={(props.icon as string) ?? null}
            onChange={(v) => updateProp('icon', v ?? undefined)}
            placeholder="Add icon..."
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Content">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Title</p>
          <Input
            value={(props.title as string) ?? 'Drop files here'}
            onChange={(e) => updateProp('title', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-1 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Description</p>
          <Input
            value={(props.description as string) ?? 'or click to browse'}
            onChange={(e) => updateProp('description', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-1 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Accepted types</p>
          <Input
            value={(props.acceptedTypes as string) ?? 'PNG, JPG, PDF'}
            onChange={(e) => updateProp('acceptedTypes', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
        <div className="px-4 pt-1 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Max file size</p>
          <Input
            value={(props.maxSize as string) ?? '10MB'}
            onChange={(e) => updateProp('maxSize', e.target.value)}
            className="h-7 text-xs rounded-md"
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = DROPZONE_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? DROPZONE_VARIANT_COLORS.default; return (<>
        <TokenColorControl
          label="Background"
          value={(props.bgColor as string) ?? ''}
          defaultColor={vc.bg}
          onChange={(v) => updateProp('bgColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Border"
          value={(props.borderColor as string) ?? ''}
          defaultColor={vc.border}
          onChange={(v) => updateProp('borderColor', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text"
          value={(props.textColor as string) ?? ''}
          defaultColor={vc.text}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Dropzone radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
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
      <InspectorSection title="Icons">
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-xs text-muted-foreground">Leading icon</span>
          <IconPicker
            value={(props.leadingIcon as string) ?? null}
            onChange={(v) => updateProp('leadingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
        </div>
        <div className="flex items-center justify-between px-4 pt-1 pb-2">
          <span className="text-xs text-muted-foreground">Trailing icon</span>
          <IconPicker
            value={(props.trailingIcon as string) ?? null}
            onChange={(v) => updateProp('trailingIcon', v ?? undefined)}
            placeholder="Add icon..."
          />
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

function PaginationSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant    = (props.variant    as string) ?? 'default'
  const totalPages = (props.totalPages as number) ?? 5
  const activePage = (props.activePage as number) ?? 3
  const size       = (props.size       as string) ?? 'md'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {['default', 'filled', 'minimal', 'rounded'].map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Size</p>
          <div className="flex gap-1.5">
            {['sm', 'md', 'lg'].map((s) => (
              <PillButton key={s} label={s} active={size === s} onClick={() => updateProp('size', s)} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Structure">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Total pages</p>
          <div className="flex gap-1.5 flex-wrap">
            {[3, 5, 7, 10].map((n) => (
              <PillButton key={n} label={String(n)} active={totalPages === n} onClick={() => updateProp('totalPages', n)} />
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Active page</p>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <PillButton key={n} label={String(n)} active={activePage === n} onClick={() => updateProp('activePage', n)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show prev / next</span>
          <Switch checked={(props.showPrevNext as boolean) ?? true} onCheckedChange={(v) => updateProp('showPrevNext', v)} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-muted-foreground">Show ellipsis</span>
          <Switch checked={(props.showEllipsis as boolean) ?? true} onCheckedChange={(v) => updateProp('showEllipsis', v)} />
        </div>
      </InspectorSection>

      <InspectorSection title="Labels">
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-muted-foreground mb-1.5">Previous label</p>
          <Input value={(props.prevLabel as string) ?? 'Previous'} onChange={(e) => updateProp('prevLabel', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Next label</p>
          <Input value={(props.nextLabel as string) ?? 'Next'} onChange={(e) => updateProp('nextLabel', e.target.value)} className="h-7 text-xs rounded-md" />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        {(() => { const vc = PAGINATION_VARIANT_COLORS[(props.variant as string) ?? 'default'] ?? PAGINATION_VARIANT_COLORS.default; return (<>
        <TokenColorControl
          label="Active background"
          value={(props.activeBg as string) ?? ''}
          defaultColor={vc.activeBg}
          onChange={(v) => updateProp('activeBg', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Active text"
          value={(props.activeText as string) ?? ''}
          defaultColor={vc.activeText}
          onChange={(v) => updateProp('activeText', v)}
          paletteColors={paletteColors}
        />
        <TokenColorControl
          label="Text color"
          value={(props.textColor as string) ?? ''}
          defaultColor={vc.text}
          onChange={(v) => updateProp('textColor', v)}
          paletteColors={paletteColors}
        />
        </>) })()}
      </InspectorSection>

      <InspectorSection title="Border Radius">
        <RadiusControl
          label="Button radius"
          value={props.borderRadius as number | undefined}
          globalValue={globalRadius}
          onChange={(v) => updateProp('borderRadius', v)}
        />
      </InspectorSection>
    </>
  )
}

function ProgressSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl label="Track color" value={(props.trackColor as string) ?? ''} defaultColor="var(--secondary)" onChange={(v) => updateProp('trackColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Indicator color" value={(props.indicatorColor as string) ?? ''} defaultColor="var(--primary)" onChange={(v) => updateProp('indicatorColor', v)} paletteColors={paletteColors} />
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

function ToggleSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl label="Active background" value={(props.activeColor as string) ?? ''} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Active text" value={(props.activeTextColor as string) ?? ''} onChange={(v) => updateProp('activeTextColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Inactive background" value={(props.inactiveColor as string) ?? ''} onChange={(v) => updateProp('inactiveColor', v)} paletteColors={paletteColors} />
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

function BreadcrumbSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl label="Link color" value={(props.linkColor as string) ?? ''} onChange={(v) => updateProp('linkColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Active page color" value={(props.activeColor as string) ?? ''} onChange={(v) => updateProp('activeColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Separator color" value={(props.separatorColor as string) ?? ''} onChange={(v) => updateProp('separatorColor', v)} paletteColors={paletteColors} />
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

function BarChartSections({ props, updateProp, paletteColors, primaryColor: _primaryColor, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
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
        <TokenColorControl label="Bar color" value={(props.barColor as string) ?? ''} defaultColor="var(--primary)" onChange={(v) => updateProp('barColor', v)} paletteColors={paletteColors} />
        {showSecondSeries && (
          <TokenColorControl label="Bar 2 color" value={(props.bar2Color as string) ?? ''} defaultColor="#94a3b8" onChange={(v) => updateProp('bar2Color', v)} paletteColors={paletteColors} />
        )}
        <TokenColorControl label="Grid color" value={(props.gridColor as string) ?? ''} defaultColor="var(--border)" onChange={(v) => updateProp('gridColor', v)} paletteColors={paletteColors} />
        <TokenColorControl label="Background" value={(props.bgColor as string) ?? ''} defaultColor="transparent" onChange={(v) => updateProp('bgColor', v)} paletteColors={paletteColors} />
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

// ─── Rating Preview (stateful, interactive) ──────────────────────────────────

function RatingPreview({ props, globalRadius }: { props: ComponentProps; globalRadius: number }) {
  const ratingVariant = (props.variant as string) ?? 'stars'
  const radius = props.borderRadius !== undefined ? `${props.borderRadius}px` : `${globalRadius}px`

  // Stars state
  const [hoverIdx,    setHoverIdx]    = useState(-1)
  const [selectedIdx, setSelectedIdx] = useState((props.activeCount as number) ?? 3)
  // Sync initial selectedIdx when prop changes from inspector
  useEffect(() => { setSelectedIdx((props.activeCount as number) ?? 3) }, [props.activeCount])

  // Emoji state
  const [selectedEmoji, setSelectedEmoji] = useState(-1)

  // Thumbs state
  const [selectedThumb, setSelectedThumb] = useState<'yes' | 'no' | null>(null)

  if (ratingVariant === 'stars') {
    const iconType    = (props.iconType    as string)  ?? 'star'
    const starCount   = (props.starCount   as number)  ?? 5
    const szKey       = (props.size        as string)  ?? 'default'
    const readOnly    = (props.readOnly    as boolean) ?? false
    const showLabel   = (props.showLabel   as boolean) ?? false
    const clearable   = (props.clearable   as boolean) ?? true
    const szMap: Record<string, number>  = { sm: 16, default: 22, lg: 30 }
    const gapMap: Record<string, number> = { sm: 3, default: 4, lg: 6 }
    const sz  = szMap[szKey]  ?? 22
    const gap = gapMap[szKey] ?? 4
    const activeColor   = (props.activeColor   as string) || '#2563EB'
    const inactiveColor = (props.inactiveColor as string) || 'var(--muted-foreground)'

    const displayIdx = !readOnly && hoverIdx >= 0 ? hoverIdx + 1 : selectedIdx

    const RatingIcon = ({ idx }: { idx: number }) => {
      const filled  = idx < displayIdx
      const color   = filled ? activeColor : inactiveColor
      const sw      = !readOnly && hoverIdx === idx ? '2.25' : '1.75'
      const scale   = !readOnly && hoverIdx === idx ? 1.12 : 1
      const common  = { width: sz, height: sz, viewBox: '0 0 24 24', fill: filled ? color : 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { cursor: readOnly ? 'default' : 'pointer', transform: `scale(${scale})`, transition: 'transform 0.1s, fill 0.1s' } }
      return iconType === 'heart' ? (
        <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
      ) : (
        <svg {...common}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
      )
    }

    return (
      <div className="flex flex-col items-center gap-2" style={{ opacity: readOnly ? 0.65 : 1 }}>
        <div
          className="flex items-center"
          style={{ gap: `${gap}px` }}
          onMouseLeave={() => !readOnly && setHoverIdx(-1)}
        >
          {Array.from({ length: starCount }, (_, i) => (
            <span
              key={i}
              onMouseEnter={() => !readOnly && setHoverIdx(i)}
              onClick={() => {
                if (readOnly) return
                setSelectedIdx(clearable && selectedIdx === i + 1 ? 0 : i + 1)
                setHoverIdx(-1)
              }}
            >
              <RatingIcon idx={i} />
            </span>
          ))}
        </div>
        {showLabel && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {selectedIdx > 0 ? `${selectedIdx} / ${starCount}` : `0 / ${starCount}`}
          </p>
        )}
      </div>
    )
  }

  if (ratingVariant === 'emoji') {
    const question    = (props.question    as string)  ?? 'Did this answer your question?'
    const showLabels  = (props.showLabels  as boolean) ?? false
    const emojis = [
      (props.emoji1 as string) ?? '😞',
      (props.emoji2 as string) ?? '😐',
      (props.emoji3 as string) ?? '🤩',
    ]
    const labels = [
      (props.label1 as string) ?? 'No',
      (props.label2 as string) ?? 'Maybe',
      (props.label3 as string) ?? 'Yes!',
    ]
    const szKey        = (props.emojiSize as string) ?? 'default'
    const szMap: Record<string, string>    = { sm: '1.5rem', default: '2rem', lg: '2.75rem' }
    const btnSzMap: Record<string, string> = { sm: '2.5rem',  default: '3.25rem', lg: '4rem' }
    const fontSize = szMap[szKey]    ?? '2rem'
    const btnSize  = btnSzMap[szKey] ?? '3.25rem'
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-foreground text-center">{question}</p>
        <div className="flex items-end gap-3">
          {emojis.map((e, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => setSelectedEmoji(selectedEmoji === i ? -1 : i)}
                className="flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer select-none"
                style={{
                  fontSize, width: btnSize, height: btnSize,
                  backgroundColor: selectedEmoji === i ? 'var(--muted)' : 'transparent',
                  outline: selectedEmoji === i ? '2px solid var(--primary)' : '2px solid transparent',
                  outlineOffset: '2px',
                  transform: selectedEmoji === i ? 'scale(1.18)' : 'scale(1)',
                }}
              >
                {e}
              </button>
              {showLabels && (
                <span className={cn('text-[10px] transition-colors', selectedEmoji === i ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {labels[i]}
                </span>
              )}
            </div>
          ))}
        </div>
        {selectedEmoji >= 0 && (
          <p className="text-xs text-muted-foreground">
            {((props.feedbackPrefix as string) ?? 'You selected:')} {emojis[selectedEmoji]}
          </p>
        )}
      </div>
    )
  }

  if (ratingVariant === 'thumbs') {
    const question    = (props.question    as string) ?? 'Was this page helpful?'
    const yesLabel    = (props.yesLabel    as string) ?? 'Yes'
    const noLabel     = (props.noLabel     as string) ?? 'No'
    const buttonStyle = (props.buttonStyle as string) ?? 'outline'

    const ThumbUp = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    )
    const ThumbDown = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z" />
        <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
      </svg>
    )

    const getBtnCls = (which: 'yes' | 'no') => cn(
      'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all cursor-pointer select-none',
      buttonStyle === 'ghost'
        ? cn('rounded-md', selectedThumb === which ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted')
        : cn('border rounded-md', selectedThumb === which ? 'bg-foreground border-foreground text-background' : 'border-border bg-background text-foreground hover:bg-muted'),
    )

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <p className="text-sm font-medium text-foreground">{question}</p>
          <div className="flex items-center gap-2">
            <button className={getBtnCls('yes')} style={{ borderRadius: radius }} onClick={() => setSelectedThumb(selectedThumb === 'yes' ? null : 'yes')}>
              <ThumbUp />{yesLabel}
            </button>
            <button className={getBtnCls('no')} style={{ borderRadius: radius }} onClick={() => setSelectedThumb(selectedThumb === 'no' ? null : 'no')}>
              <ThumbDown />{noLabel}
            </button>
          </div>
        </div>
        {selectedThumb && (
          <p className="text-xs text-muted-foreground">
            {selectedThumb === 'yes'
              ? ((props.yesFeedback as string) ?? '👍 Thanks for the feedback!')
              : ((props.noFeedback  as string) ?? "👎 We'll work to improve.")
            }
          </p>
        )}
      </div>
    )
  }

  return null
}

function RatingSections({ props, updateProp, paletteColors, globalRadius, onChangeGlobalRadius }: InspectorSharedProps) {
  const variant     = (props.variant     as string)  ?? 'stars'
  const iconType    = (props.iconType    as string)  ?? 'star'
  const starCount   = (props.starCount   as number)  ?? 5
  const emojiSize   = (props.emojiSize   as string)  ?? 'default'
  const buttonStyle = (props.buttonStyle as string)  ?? 'outline'

  return (
    <>
      <GlobalSettingsSection globalRadius={globalRadius} onChangeGlobalRadius={onChangeGlobalRadius} />

      <InspectorSection title="Appearance">
        <div className="px-4 pt-2 pb-2">
          <p className="text-xs text-muted-foreground mb-1.5">Variant</p>
          <div className="flex flex-wrap gap-1.5">
            {(['stars', 'emoji', 'thumbs'] as const).map((v) => (
              <PillButton key={v} label={v} active={variant === v} onClick={() => updateProp('variant', v)} />
            ))}
          </div>
        </div>

        {variant === 'stars' && (<>
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Icon</p>
            <div className="flex gap-1.5">
              {(['star', 'heart'] as const).map((t) => (
                <PillButton key={t} label={t} active={iconType === t} onClick={() => updateProp('iconType', t)} />
              ))}
            </div>
          </div>
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Size</p>
            <div className="flex gap-1.5">
              {(['sm', 'default', 'lg'] as const).map((s) => (
                <PillButton key={s} label={s} active={((props.size as string) ?? 'default') === s} onClick={() => updateProp('size', s)} />
              ))}
            </div>
          </div>
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Total stars</p>
            <div className="flex gap-1.5">
              {[3, 4, 5, 6, 7, 10].map((n) => (
                <PillButton key={n} label={String(n)} active={starCount === n} onClick={() => updateProp('starCount', n)} />
              ))}
            </div>
          </div>
        </>)}

        {variant === 'emoji' && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Size</p>
            <div className="flex gap-1.5">
              {(['sm', 'default', 'lg'] as const).map((s) => (
                <PillButton key={s} label={s} active={emojiSize === s} onClick={() => updateProp('emojiSize', s)} />
              ))}
            </div>
          </div>
        )}

        {variant === 'thumbs' && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Button style</p>
            <div className="flex gap-1.5">
              {(['outline', 'ghost'] as const).map((s) => (
                <PillButton key={s} label={s} active={buttonStyle === s} onClick={() => updateProp('buttonStyle', s)} />
              ))}
            </div>
          </div>
        )}
      </InspectorSection>

      {variant === 'stars' && (
        <InspectorSection title="States">
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <span className="text-xs text-muted-foreground">Read only</span>
            <Switch checked={(props.readOnly as boolean) ?? false} onCheckedChange={(v) => updateProp('readOnly', v)} />
          </div>
          <div className="flex items-center justify-between px-4 py-1 pb-2">
            <span className="text-xs text-muted-foreground">Show label</span>
            <Switch checked={(props.showLabel as boolean) ?? false} onCheckedChange={(v) => updateProp('showLabel', v)} />
          </div>
          <div className="flex items-center justify-between px-4 py-1 pb-2">
            <span className="text-xs text-muted-foreground">Clearable (click to clear)</span>
            <Switch checked={(props.clearable as boolean) ?? true} onCheckedChange={(v) => updateProp('clearable', v)} />
          </div>
        </InspectorSection>
      )}

      {variant === 'emoji' && (
        <InspectorSection title="States">
          <div className="flex items-center justify-between px-4 pt-2 pb-2">
            <span className="text-xs text-muted-foreground">Show labels</span>
            <Switch checked={(props.showLabels as boolean) ?? false} onCheckedChange={(v) => updateProp('showLabels', v)} />
          </div>
        </InspectorSection>
      )}

      {(variant === 'emoji' || variant === 'thumbs') && (
        <InspectorSection title="Content">
          <div className="px-4 pt-2 pb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Question text</p>
            <Input
              value={(props.question as string) ?? (variant === 'thumbs' ? 'Was this page helpful?' : 'Did this answer your question?')}
              onChange={(e) => updateProp('question', e.target.value)}
              className="h-7 text-xs rounded-md"
            />
          </div>
          {variant === 'emoji' && (<>
            {([['emoji1', '😞', 'label1', 'No'], ['emoji2', '😐', 'label2', 'Maybe'], ['emoji3', '🤩', 'label3', 'Yes!']] as [string, string, string, string][]).map(([eKey, eDef, lKey, lDef]) => (
              <div key={eKey} className="flex items-center justify-between gap-2 px-4 pb-2">
                <span className="text-xs text-muted-foreground shrink-0">{eKey.replace('emoji', 'Emoji ')}</span>
                <div className="flex gap-1.5">
                  <Input value={(props[eKey] as string) ?? eDef} onChange={(e) => updateProp(eKey, e.target.value)} className="h-7 w-14 text-xs rounded-md text-center" />
                  {(props.showLabels as boolean) && (
                    <Input value={(props[lKey] as string) ?? lDef} onChange={(e) => updateProp(lKey, e.target.value)} className="h-7 w-16 text-xs rounded-md" placeholder={lDef} />
                  )}
                </div>
              </div>
            ))}
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">Feedback prefix</p>
              <Input
                value={(props.feedbackPrefix as string) ?? 'You selected:'}
                onChange={(e) => updateProp('feedbackPrefix', e.target.value)}
                className="h-7 text-xs rounded-md"
              />
            </div>
          </>)}
          {variant === 'thumbs' && (<>
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs text-muted-foreground">Yes label</span>
              <Input value={(props.yesLabel as string) ?? 'Yes'} onChange={(e) => updateProp('yesLabel', e.target.value)} className="h-7 w-24 text-xs rounded-md" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-xs text-muted-foreground">No label</span>
              <Input value={(props.noLabel as string) ?? 'No'} onChange={(e) => updateProp('noLabel', e.target.value)} className="h-7 w-24 text-xs rounded-md" />
            </div>
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">Yes feedback</p>
              <Input
                value={(props.yesFeedback as string) ?? '👍 Thanks for the feedback!'}
                onChange={(e) => updateProp('yesFeedback', e.target.value)}
                className="h-7 text-xs rounded-md"
              />
            </div>
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">No feedback</p>
              <Input
                value={(props.noFeedback as string) ?? "👎 We'll work to improve."}
                onChange={(e) => updateProp('noFeedback', e.target.value)}
                className="h-7 text-xs rounded-md"
              />
            </div>
          </>)}
        </InspectorSection>
      )}

      {variant === 'stars' && (
        <InspectorSection title="Colors">
          <TokenColorControl
            label="Active color"
            value={(props.activeColor as string) ?? ''}
            defaultColor="#2563EB"
            onChange={(v) => updateProp('activeColor', v)}
            paletteColors={paletteColors}
          />
          <TokenColorControl
            label="Inactive color"
            value={(props.inactiveColor as string) ?? ''}
            defaultColor="var(--muted-foreground)"
            onChange={(v) => updateProp('inactiveColor', v)}
            paletteColors={paletteColors}
          />
        </InspectorSection>
      )}
    </>
  )
}

// ─── Inspector router ─────────────────────────────────────────────────────────

function Inspector({
  component,
  ...shared
}: { component: string } & InspectorSharedProps) {
  if (component === 'Accordion') return <AccordionSections {...shared} />
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
  if (component === 'Spinner') return <SpinnerSections {...shared} />
  if (component === 'Table') return <TableSections {...shared} />
  if (component === 'Textarea') return <TextareaSections {...shared} />
  if (component === 'Checkbox') return <CheckboxSections {...shared} />
  if (component === 'Dialog') return <DialogSections {...shared} />
  if (component === 'Dropdown Menu') return <DropdownMenuSections {...shared} />
  if (component === 'Dropzone') return <DropzoneSections {...shared} />
  if (component === 'Input OTP') return <InputOTPSections {...shared} />
  if (component === 'Kbd') return <KbdSections {...shared} />
  if (component === 'Label') return <LabelSections {...shared} />
  if (component === 'Popover') return <PopoverSections {...shared} />
  if (component === 'Pagination') return <PaginationSections {...shared} />
  if (component === 'Progress') return <ProgressSections {...shared} />
  if (component === 'Radio Group') return <RadioGroupSections {...shared} />
  if (component === 'Rating') return <RatingSections {...shared} />
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
          style={{ ...bgStyle((props.bgColor as string) || undefined), borderRadius: radius }}
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
          ...bgStyle((props.bgColor as string) || undefined),
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
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
type AlertVariant = 'default' | 'destructive'

// ─── Gradient Handle Overlay ──────────────────────────────────────────────────

function GradientHandleOverlay({
  gradient,
  onUpdate,
}: {
  gradient: string
  onUpdate: (newGradient: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setSize({ w: el.offsetWidth, h: el.offsetHeight })
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const parsed = parseGradient(gradient)
  if (!parsed) return null
  const { angle, from: fromColor, to: toColor } = parsed

  const { w, h } = size
  const cx = w / 2
  const cy = h / 2
  const R = Math.max(28, Math.min(72, Math.min(w, h) * 0.38))
  const rad = (angle * Math.PI) / 180
  const toX = cx + R * Math.sin(rad)
  const toY = cy - R * Math.cos(rad)
  const fromX = cx - R * Math.sin(rad)
  const fromY = cy + R * Math.cos(rad)

  function startDrag(which: 'from' | 'to', e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ccx = rect.width / 2
    const ccy = rect.height / 2
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - rect.left - ccx
      const dy = ev.clientY - rect.top - ccy
      let newAngle = which === 'to'
        ? Math.atan2(dx, -dy) * 180 / Math.PI
        : Math.atan2(-dx, dy) * 180 / Math.PI
      newAngle = ((Math.round(newAngle) % 360) + 360) % 360
      onUpdate(`linear-gradient(${newAngle}deg, ${fromColor}, ${toColor})`)
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ overflow: 'visible', zIndex: 10 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {w > 0 && h > 0 && (
        <>
          <svg
            width={w}
            height={h}
            className="absolute inset-0"
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="rgba(0,0,0,0.35)" strokeWidth={3} strokeLinecap="round" />
            <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="white" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" opacity={0.85} />
            <text
              x={toX + (toX > cx ? 12 : -12)}
              y={toY + (toY > cy ? 14 : -6)}
              textAnchor={toX > cx ? 'start' : 'end'}
              fontSize={10}
              fill="white"
              style={{ userSelect: 'none', fontFamily: 'monospace' }}
            >{angle}°</text>
          </svg>
          {/* From handle */}
          <div
            onPointerDown={(e) => startDrag('from', e)}
            style={{
              position: 'absolute',
              left: fromX - 8,
              top: fromY - 8,
              width: 16,
              height: 16,
              borderRadius: 3,
              background: fromColor,
              border: '2px solid white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              cursor: 'grab',
            }}
          />
          {/* To handle */}
          <div
            onPointerDown={(e) => startDrag('to', e)}
            style={{
              position: 'absolute',
              left: toX - 8,
              top: toY - 8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: toColor,
              border: '2px solid white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              cursor: 'grab',
            }}
          />
        </>
      )}
    </div>
  )
}

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

  if (name === 'Dropzone') {
    const dzVariant = (props.variant as string) ?? 'default'
    const borderStyle = (props.borderStyle as string) ?? 'dashed'
    const UploadIcon = props.icon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.icon as string] ?? null
      : null

    const variantStyles: Record<string, { border: string; bg: string; text: string; subtext: string; iconColor: string }> = {
      default: { border: 'var(--border)',   bg: 'transparent',          text: 'var(--foreground)',     subtext: 'var(--muted-foreground)', iconColor: 'var(--muted-foreground)' },
      active:  { border: 'var(--primary)',  bg: 'color-mix(in oklch, var(--primary) 8%, transparent)', text: 'var(--primary)',        subtext: 'var(--primary)',         iconColor: 'var(--primary)' },
      success: { border: '#16a34a',         bg: 'color-mix(in oklch, #16a34a 8%, transparent)',         text: '#15803d',               subtext: '#16a34a',                iconColor: '#16a34a' },
      error:   { border: 'var(--destructive)', bg: 'color-mix(in oklch, var(--destructive) 8%, transparent)', text: 'var(--destructive)', subtext: 'var(--destructive)', iconColor: 'var(--destructive)' },
    }
    const vs = variantStyles[dzVariant] ?? variantStyles.default

    return (
      <div
        style={{
          borderStyle: borderStyle as React.CSSProperties['borderStyle'],
          borderWidth: 2,
          borderColor: (props.borderColor as string) || vs.border,
          ...bgStyle((props.bgColor as string) || vs.bg),
          borderRadius: radius,
          color: (props.textColor as string) || vs.text,
          minWidth: 320,
        }}
        className="flex flex-col items-center justify-center gap-2 px-10 py-10 cursor-pointer select-none transition-colors"
      >
        {UploadIcon
          ? <UploadIcon size={32} style={{ color: vs.iconColor }} className="mb-1 shrink-0" />
          : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: vs.iconColor }} className="mb-1 shrink-0 opacity-60">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
        }
        <p className="text-sm font-medium leading-tight text-center">{(props.title as string) ?? 'Drop files here'}</p>
        <p className="text-xs text-center leading-tight" style={{ color: vs.subtext, opacity: 0.8 }}>
          {(props.description as string) ?? 'or click to browse'}
        </p>
        <p className="text-[11px] text-center mt-1" style={{ color: vs.subtext, opacity: 0.6 }}>
          {[(props.acceptedTypes as string) ?? 'PNG, JPG, PDF', `Max ${(props.maxSize as string) ?? '10MB'}`].join(' · ')}
        </p>
      </div>
    )
  }

  if (name === 'Accordion') {
    const acVariant = (props.variant as string) ?? 'default'
    const itemCount = (props.itemCount as number) ?? 3
    const multiple = (props.multiple as boolean) ?? false
    const chevronSide = (props.chevronSide as string) ?? 'right'
    const bgColor = (props.bgColor as string) || undefined
    const triggerColor = (props.triggerColor as string) || undefined
    const contentColor = (props.contentColor as string) || undefined
    const borderColor = (props.borderColor as string) || 'var(--border)'

    const variantItemClass: Record<string, string> = {
      default:   'not-last:border-b border-border',
      separated: 'border border-border rounded-lg mb-2',
      bordered:  'border border-border first:rounded-t-lg last:rounded-b-lg not-last:border-b-0',
      ghost:     '',
    }
    const variantTriggerClass: Record<string, string> = {
      default:   'hover:bg-muted/40 px-1',
      separated: 'hover:bg-muted/40 px-3',
      bordered:  'hover:bg-muted/40 px-3',
      ghost:     'hover:bg-transparent px-1',
    }

    const accordionItems = Array.from({ length: itemCount }, (_, i) => {
      const LeadingIcon = props[`item${i}LeadingIcon`]
        ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props[`item${i}LeadingIcon`] as string] ?? null
        : null
      const TrailingIcon = props[`item${i}TrailingIcon`]
        ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props[`item${i}TrailingIcon`] as string] ?? null
        : null
      return (
        <AccordionItem
          key={i}
          value={`item-${i}`}
          className={variantItemClass[acVariant]}
          style={{ borderColor, borderRadius: acVariant === 'separated' ? radius : undefined }}
        >
          <AccordionTrigger
            className={cn('py-3 text-sm font-medium flex-row-reverse justify-end gap-2', variantTriggerClass[acVariant], chevronSide === 'right' && 'flex-row justify-between')}
            style={{ color: triggerColor }}
          >
            <span className="flex items-center gap-2 min-w-0">
              {LeadingIcon && <LeadingIcon size={15} className="shrink-0" />}
              <span>{(props[`item${i}Title`] as string) ?? `Section ${i + 1}`}</span>
            </span>
            {TrailingIcon && <TrailingIcon size={15} className="shrink-0 ml-auto mr-1" />}
          </AccordionTrigger>
          <AccordionContent
            className={cn(acVariant === 'separated' || acVariant === 'bordered' ? 'px-3' : 'px-1')}
            style={{ color: contentColor }}
          >
            {(props[`item${i}Content`] as string) ?? 'Content goes here.'}
          </AccordionContent>
        </AccordionItem>
      )
    })
    const accordionSharedProps = { className: 'w-[340px]', style: { ...bgStyle(bgColor), borderRadius: radius } }
    return multiple ? (
      <Accordion type="multiple" defaultValue={['item-0']} {...accordionSharedProps}>
        {accordionItems}
      </Accordion>
    ) : (
      <Accordion type="single" collapsible defaultValue="item-0" {...accordionSharedProps}>
        {accordionItems}
      </Accordion>
    )
  }

  if (name === 'Alert') {
    const alertVariant = (props.variant as string) ?? 'default'
    const leadingIconName = props.leadingIcon as string | undefined
    const trailingIconName = props.trailingIcon as string | undefined
    const LeadingIcon = leadingIconName
      ? (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[leadingIconName]
      : undefined
    const TrailingIcon = trailingIconName
      ? (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[trailingIconName]
      : undefined
    const variantClass: Record<string, string> = {
      success: 'border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
      warning: 'border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-500',
      info:    'border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 [&>svg]:text-blue-500',
    }
    const shadcnVariant: AlertVariant = alertVariant === 'destructive' ? 'destructive' : 'default'
    const alertBgColor = props.bgColor as string | undefined
    const alertTextColor = props.textColor as string | undefined
    const alertBorderColor = props.borderColor as string | undefined
    const alertDescColor = props.descriptionColor as string | undefined
    const colorStyle: React.CSSProperties = {
      borderRadius: radius,
      ...(alertBgColor ? { backgroundColor: alertBgColor } : {}),
      ...(alertTextColor ? { color: alertTextColor } : {}),
      ...(alertBorderColor ? { borderColor: alertBorderColor } : {}),
    }
    return (
      <Alert
        variant={shadcnVariant}
        className={cn('w-[380px]', variantClass[alertVariant], trailingIconName && 'pr-12')}
        style={colorStyle}
      >
        {LeadingIcon && <LeadingIcon className="h-4 w-4" />}
        <AlertTitle>{(props.title as string) ?? 'Heads up!'}</AlertTitle>
        <AlertDescription style={alertDescColor ? { color: alertDescColor } : undefined}>{(props.description as string) ?? 'You can add components to your app using the CLI.'}</AlertDescription>
        {TrailingIcon && (
          <div className="absolute right-4 top-4">
            <TrailingIcon className="h-4 w-4 opacity-50" />
          </div>
        )}
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
      ? { border: `${props.strokeWidth}px solid ${(props.borderColor as string) ?? 'var(--border)'}` }
      : {}
    return (
      <Avatar className={cn(sizeClass, shapeClass)} style={{ ...borderStyle, borderRadius: explicitRadius }}>
        {avType === 'image' && (
          <AvatarImage src={(props.imageUrl as string) ?? 'https://github.com/shadcn.png'} alt="Avatar" />
        )}
        <AvatarFallback className={shapeClass} style={{ ...bgStyle((props.bgColor as string) ?? CSS_PRIMARY), color: (props.textColor as string) ?? CSS_PRIMARY_FG }}>
          {avType === 'icon' && AvatarFallbackIcon
            ? <AvatarFallbackIcon size={iconSize} />
            : ((props.fallback as string) ?? 'AB')
          }
        </AvatarFallback>
      </Avatar>
    )
  }

  if (name === 'Badge') {
    const badgeSize = (props.size as string) ?? 'md'
    const sizePreset = BADGE_SIZE_PRESETS[badgeSize] ?? BADGE_SIZE_PRESETS.md
    const badgePadding = (props.padding as PaddingValue | undefined) ?? sizePreset.padding
    const badgeVariant = (props.variant as BadgeVariant) ?? 'default'
    const BadgeLeadingIcon = props.leadingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.leadingIcon as string] ?? null
      : null
    const BadgeTrailingIcon = props.trailingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.trailingIcon as string] ?? null
      : null
    const badgeVariantClass: Record<string, string> = {
      success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      info:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    }
    type ShadcnBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'
    const shadcnBadgeVariant: ShadcnBadgeVariant = ['success', 'warning', 'info'].includes(badgeVariant) ? 'outline' : badgeVariant as ShadcnBadgeVariant
    const badgeStrokeWidth = (props.strokeWidth as number) ?? 1
    const badgeBorderColor = (props.borderColor as string) || undefined
    return (
      <Badge
        variant={shadcnBadgeVariant}
        className={badgeVariantClass[badgeVariant]}
        style={{
          ...bgStyle((props.bgColor as string) || undefined),
          color: (props.textColor as string) || undefined,
          borderRadius: radius,
          borderWidth: `${badgeStrokeWidth}px`,
          borderStyle: badgeStrokeWidth > 0 ? 'solid' : 'none',
          ...(badgeBorderColor ? { borderColor: badgeBorderColor } : {}),
          height: `${sizePreset.height}px`,
          fontSize: `${(props.fontSize as number) ?? sizePreset.fontSize}px`,
          fontWeight: props.fontWeight as string | undefined,
          paddingTop: `${badgePadding.top}px`,
          paddingBottom: `${badgePadding.bottom}px`,
          paddingLeft: `${badgePadding.left}px`,
          paddingRight: `${badgePadding.right}px`,
        }}
      >
        {BadgeLeadingIcon && <BadgeLeadingIcon size={12} className="shrink-0" />}
        {(props.label as string) ?? 'Badge'}
        {BadgeTrailingIcon && <BadgeTrailingIcon size={12} className="shrink-0" />}
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
          ...bgStyle((props.bgColor as string) || undefined),
          color: (props.textColor as string) || undefined,
          borderColor: (props.borderColor as string) || undefined,
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
          ...bgStyle((props.bgColor as string) ?? 'var(--card)'),
          borderColor: (props.borderColor as string) ?? 'var(--border)',
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
            ...bgStyle((props.bgColor as string) || undefined),
            color: (props.textColor as string) || undefined,
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

  if (name === 'Input OTP') {
    const length = (props.length as number) ?? 6
    const grouped = (props.grouped as boolean) ?? false
    const slotStyle = (props.slotStyle as string) ?? 'bordered'
    const slotSize = (props.slotSize as string) ?? 'md'
    const mask = (props.mask as boolean) ?? false
    const disabled = (props.disabled as boolean) ?? false
    const hasError = (props.errorState as boolean) ?? false
    const rawValue = (props.previewValue as string) ?? ''
    const value = mask ? rawValue.replace(/./g, '●') : rawValue
    const half = Math.floor(length / 2)

    const slotDim: Record<string, string> = { sm: '28px', md: '36px', lg: '48px' }
    const slotFontSize: Record<string, string> = { sm: '11px', md: '14px', lg: '18px' }
    const dim = slotDim[slotSize] ?? slotDim.md
    const fontSize = slotFontSize[slotSize] ?? slotFontSize.md
    const borderColor = hasError ? 'var(--destructive)' : ((props.slotBorder as string) || 'var(--input)')
    const bgColor = slotStyle === 'filled' ? ((props.slotBg as string) || 'var(--muted)') : ((props.slotBg as string) || 'transparent')
    const textColor = (props.textColor as string) || 'var(--foreground)'

    const renderSlots = (count: number, offset: number) =>
      Array.from({ length: count }, (_, i) => {
        const char = value[offset + i] ?? ''
        const isFirst = i === 0
        const isLast = i === count - 1
        const br = slotStyle === 'underline' ? '0px'
          : isFirst && isLast ? radius
          : isFirst ? `${radius} 0 0 ${radius}`
          : isLast  ? `0 ${radius} ${radius} 0`
          : '0'
        return (
          <div
            key={offset + i}
            style={{
              width: dim, height: dim, fontSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace', borderRadius: br,
              borderTop:    slotStyle === 'underline' ? 'none' : `1px solid ${borderColor}`,
              borderBottom: `1px solid ${borderColor}`,
              borderLeft:   slotStyle === 'underline' || !isFirst ? 'none' : `1px solid ${borderColor}`,
              borderRight:  slotStyle === 'underline' ? 'none' : `1px solid ${borderColor}`,
              ...bgStyle(bgColor), color: textColor,
              opacity: disabled ? 0.5 : 1,
              ...(hasError ? { boxShadow: '0 0 0 3px oklch(from var(--destructive) l c h / 0.2)' } : {}),
            }}
          >
            {char || <div style={{ width: '1px', height: '1em', backgroundColor: 'currentColor', opacity: 0.2 }} />}
          </div>
        )
      })

    return (
      <div className="flex flex-col gap-1.5">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>{renderSlots(grouped ? half : length, 0)}</div>
          {grouped && (
            <>
              <span style={{ padding: '0 6px', color: 'var(--muted-foreground)', fontSize: '18px', lineHeight: 1 }}>—</span>
              <div style={{ display: 'flex' }}>{renderSlots(length - half, half)}</div>
            </>
          )}
        </div>
        {hasError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            {(props.errorMessage as string) ?? 'Invalid verification code.'}
          </p>
        )}
      </div>
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
          aria-invalid={hasError || undefined}
          className={cn('w-[280px]', hasError && 'border-destructive ring-3 ring-destructive/20')}
          style={{
            ...bgStyle((props.bgColor as string) ?? 'var(--background)'),
            color: (props.textColor as string) ?? 'var(--foreground)',
            borderColor: hasError ? undefined : (props.borderColor as string) || undefined,
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

  if (name === 'Kbd') {
    const kbdVariant = (props.variant as 'default' | 'outline' | 'ghost' | 'solid') ?? 'default'
    const kbdSize   = (props.size     as 'sm' | 'default' | 'lg') ?? 'default'
    const pressed   = (props.pressed  as boolean) ?? false
    const disabled  = (props.disabled as boolean) ?? false
    const key1 = (props.key1 as string) ?? '⌘'
    const key2 = (props.key2 as string) ?? 'K'
    const key3 = (props.key3 as string) ?? ''
    const keys = [key1, key2, key3].filter(Boolean)
    const padding = props.padding as PaddingValue | undefined
    const kbdStyle: React.CSSProperties = {
      ...bgStyle(props.bgColor as string),
      ...(props.textColor ? { color: props.textColor as string } : {}),
      ...(props.borderColor ? { borderColor: props.borderColor as string } : {}),
      borderRadius: radius,
      ...(props.fontSize ? { fontSize: `${props.fontSize as number}px` } : {}),
      ...(padding ? { paddingTop: `${padding.top}px`, paddingBottom: `${padding.bottom}px`, paddingLeft: `${padding.left}px`, paddingRight: `${padding.right}px` } : {}),
      ...(pressed  ? { transform: 'translateY(1px)', boxShadow: 'none' } : {}),
      opacity: disabled ? 0.5 : 1,
    }
    return (
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {keys.map((key, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-xs text-muted-foreground select-none">+</span>}
            <Kbd variant={kbdVariant} size={kbdSize} style={kbdStyle}>
              {key}
            </Kbd>
          </Fragment>
        ))}
      </div>
    )
  }

  if (name === 'Rating') {
    return <RatingPreview props={props} globalRadius={globalRadius} />
  }

  if (name === 'Label') {
    const fontWeightMap: Record<string, string> = { normal: '400', medium: '500', semibold: '600', bold: '700' }
    const letterSpacingMap: Record<string, string> = { tight: '-0.025em', normal: '0em', wide: '0.05em' }
    const isDisabled = (props.disabled as boolean) ?? false
    const LabelLeadingIcon = props.leadingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.leadingIcon as string] ?? null
      : null
    const LabelTrailingIcon = props.trailingIcon
      ? (LucideIcons as unknown as Record<string, LucideIconComp | undefined>)[props.trailingIcon as string] ?? null
      : null
    const fontSize = (props.fontSize as number) ?? 14
    return (
      <Label
        className={cn('flex items-center gap-1', isDisabled && 'opacity-50 cursor-not-allowed')}
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: fontWeightMap[(props.fontWeight as string) ?? 'medium'] ?? '500',
          letterSpacing: letterSpacingMap[(props.letterSpacing as string) ?? 'normal'] ?? '0em',
          color: (props.textColor as string) || undefined,
        }}
      >
        {LabelLeadingIcon && <LabelLeadingIcon size={fontSize} className="shrink-0" />}
        {(props.text as string) ?? 'Form label'}
        {(props.required as boolean) && <span className="text-destructive ml-0.5">*</span>}
        {LabelTrailingIcon && <LabelTrailingIcon size={fontSize} className="shrink-0" />}
      </Label>
    )
  }

  if (name === 'Popover') {
    return <PopoverPreview props={props} globalRadius={globalRadius} />
  }

  if (name === 'Pagination') {
    const pgVariant    = (props.variant      as string)  ?? 'default'
    const totalPages   = (props.totalPages   as number)  ?? 5
    const activePage   = Math.min(Math.max((props.activePage as number) ?? 3, 1), totalPages)
    const showPrevNext = (props.showPrevNext as boolean) ?? true
    const showEllipsis = (props.showEllipsis as boolean) ?? true
    const prevLabel    = (props.prevLabel    as string)  ?? 'Previous'
    const nextLabel    = (props.nextLabel    as string)  ?? 'Next'
    const pgSize       = (props.size         as string)  ?? 'md'
    const activeBg     = (props.activeBg     as string)  || undefined
    const activeText   = (props.activeText   as string)  || undefined
    const textColor    = (props.textColor    as string)  || undefined

    const btnRadius = pgVariant === 'rounded' ? '999px' : radius
    const btnSize: Record<string, string> = { sm: 'icon', md: 'icon', lg: 'icon' }
    const linkSize = btnSize[pgSize] ?? 'icon'

    // Build page number list with ellipsis
    const getPages = (): (number | 'ellipsis')[] => {
      if (!showEllipsis || totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
      const pages: (number | 'ellipsis')[] = [1]
      if (activePage > 3) pages.push('ellipsis')
      for (let p = Math.max(2, activePage - 1); p <= Math.min(totalPages - 1, activePage + 1); p++) pages.push(p)
      if (activePage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
      return pages
    }

    const activeClass = cn(
      pgVariant === 'filled'  && 'bg-primary! text-primary-foreground! border-primary! hover:bg-primary/90!',
      pgVariant === 'minimal' && 'bg-transparent! border-transparent! font-semibold underline underline-offset-2',
    )
    const inactiveClass = cn(
      pgVariant === 'minimal' && 'border-transparent! bg-transparent!',
    )

    return (
      <Pagination style={{ color: textColor }}>
        <PaginationContent className="flex-wrap justify-center gap-0.5">
          {showPrevNext && (
            <PaginationItem>
              <PaginationPrevious
                text={prevLabel}
                href="#"
                className={cn(inactiveClass, pgSize === 'sm' && 'text-xs h-7! px-2!')}
                style={{ borderRadius: btnRadius, color: textColor }}
                onClick={(e) => e.preventDefault()}
              />
            </PaginationItem>
          )}
          {getPages().map((p, i) =>
            p === 'ellipsis' ? (
              <PaginationItem key={`ell-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === activePage}
                  size={linkSize as 'icon'}
                  className={cn(p === activePage ? activeClass : inactiveClass, pgSize === 'sm' && 'size-7! text-xs!', pgSize === 'lg' && 'size-10! text-base!')}
                  style={{
                    borderRadius: btnRadius,
                    ...(p === activePage && activeBg    ? { backgroundColor: activeBg,  borderColor: activeBg  } : {}),
                    ...(p === activePage && activeText  ? { color: activeText } : {}),
                    ...(!( p === activePage) && textColor ? { color: textColor } : {}),
                  }}
                  onClick={(e) => { e.preventDefault(); updateProp('activePage', p) }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          {showPrevNext && (
            <PaginationItem>
              <PaginationNext
                text={nextLabel}
                href="#"
                className={cn(inactiveClass, pgSize === 'sm' && 'text-xs h-7! px-2!')}
                style={{ borderRadius: btnRadius, color: textColor }}
                onClick={(e) => e.preventDefault()}
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    )
  }

  if (name === 'Progress') {
    const progressVal = Math.min(100, Math.max(0, (props.value as number) ?? 60))
    const progressSize = (props.size as string) ?? 'default'
    const progressStyle = (props.style as string) ?? 'default'
    const sizeClass = progressSize === 'sm' ? 'h-1.5' : progressSize === 'lg' ? 'h-4' : 'h-2.5'
    const indicatorColor = (props.indicatorColor as string) || 'var(--primary)'
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

  if (name === 'Radio Group') { // centered
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
          className={cn(rgOrientation === 'horizontal' ? 'flex flex-row gap-4' : 'flex flex-col gap-2', 'w-fit')}
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
              ...bgStyle((props.bgColor as string) || undefined),
              borderColor: (props.borderColor as string) || undefined,
              color: (props.textColor as string) || undefined,
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

  if (name === 'Spinner') {
    const variant  = (props.variant  as string) ?? 'border'
    const size     = (props.size     as string) ?? 'md'
    const speed    = (props.speed    as string) ?? 'normal'
    const label    = (props.label    as string) ?? ''
    const labelPos = (props.labelPosition as string) ?? 'bottom'
    const color    = (props.color     as string) || 'var(--primary)'
    const trackColor = (props.trackColor as string) || 'var(--border)'
    const labelColor = (props.labelColor as string) || 'var(--muted-foreground)'
    const thickness  = (props.thickness as number) ?? 2

    const dimMap: Record<string, number> = { xs: 14, sm: 20, md: 28, lg: 40, xl: 56 }
    const dim = dimMap[size] ?? dimMap.md
    const speedMap: Record<string, string> = { slow: '2s', normal: '1s', fast: '0.5s' }
    const dur = speedMap[speed] ?? '1s'

    let spinnerEl: React.ReactNode = null

    if (variant === 'border') {
      spinnerEl = (
        <div
          className="animate-spin rounded-full shrink-0"
          style={{
            width: dim, height: dim,
            borderWidth: thickness,
            borderStyle: 'solid',
            borderColor: `${trackColor} ${trackColor} ${trackColor} ${color}`,
            animationDuration: dur,
          }}
        />
      )
    } else if (variant === 'dots') {
      const dotSize = Math.max(4, Math.round(dim * 0.22))
      spinnerEl = (
        <div className="flex items-center gap-1" style={{ '--spinner-speed': dur } as React.CSSProperties}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="spinner-dot rounded-full shrink-0" style={{ width: dotSize, height: dotSize, backgroundColor: color }} />
          ))}
        </div>
      )
    } else if (variant === 'bars') {
      const barW = Math.max(3, Math.round(dim * 0.14))
      const barH = dim
      spinnerEl = (
        <div className="flex items-center gap-0.5" style={{ height: barH, '--spinner-speed': dur } as React.CSSProperties}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="spinner-bar rounded-sm shrink-0" style={{ width: barW, height: barH, backgroundColor: color }} />
          ))}
        </div>
      )
    } else if (variant === 'pulse') {
      spinnerEl = (
        <div className="relative shrink-0" style={{ width: dim, height: dim }}>
          <div
            className="spinner-pulse-ring absolute inset-0 rounded-full"
            style={{ border: `${thickness}px solid ${color}`, '--spinner-speed': dur } as React.CSSProperties}
          />
          <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color, opacity: 0.25 }} />
        </div>
      )
    }

    const inner = (
      <div className={cn('flex items-center', labelPos === 'bottom' ? 'flex-col gap-2' : 'flex-row gap-3')}>
        {spinnerEl}
        {label && <span className="text-xs" style={{ color: labelColor }}>{label}</span>}
      </div>
    )

    return inner
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
        <div className="w-[720px] max-w-full">
          <Table style={borderColor && !isBorderless ? { borderColor } : {}}>
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
    const tabPadding = props.tabPadding as PaddingValue | undefined
    const contentPadding = props.contentPadding as PaddingValue | undefined
    const listClass = cn(
      tabVariant === 'underline' && '!bg-transparent border-0 border-b border-border rounded-none p-0 h-auto gap-6',
      tabVariant === 'pill' && '!rounded-full',
      tabVariant === 'bordered' && '!bg-transparent !rounded-none border-b border-border',
    )
    const triggerClass = cn(
      tabVariant === 'underline' && '!border-0 !border-b-2 !border-transparent !rounded-none !shadow-none px-1 pb-2 data-[state=active]:!border-b-2 data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!shadow-none data-[state=active]:text-foreground',
      tabVariant === 'pill' && '!rounded-full',
      tabVariant === 'bordered' && 'border border-transparent rounded-t-md data-[state=active]:!bg-background data-[state=active]:border-border',
    )
    const triggerStyle: React.CSSProperties = tabPadding ? {
      paddingTop: `${tabPadding.top}px`,
      paddingBottom: `${tabPadding.bottom}px`,
      paddingLeft: `${tabPadding.left}px`,
      paddingRight: `${tabPadding.right}px`,
    } : {}
    const contentStyle: React.CSSProperties = contentPadding ? {
      paddingTop: `${contentPadding.top}px`,
      paddingBottom: `${contentPadding.bottom}px`,
      paddingLeft: `${contentPadding.left}px`,
      paddingRight: `${contentPadding.right}px`,
    } : {}
    return (
      <div className="flex w-full justify-center">
        <Tabs defaultValue="tab0" className="w-[320px]">
          <TabsList className={listClass}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={triggerClass} style={triggerStyle}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab, i) => (
            <TabsContent key={tab.value} value={tab.value} className="text-sm text-muted-foreground pt-2" style={contentStyle}>
              {(props[`tab${i}Content`] as string) ?? `Content for ${tab.label}.`}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    )
  }

  if (name === 'Textarea') {
    const taResize = (props.resize as string) ?? 'vertical'
    const taRows = (props.rows as number) ?? 4
    const taBg = (props.bgColor as string) || ''
    const taBorder = (props.borderColor as string) || ''
    const taText = (props.textColor as string) || ''
    const taRadius = props.borderRadius !== undefined ? `${props.borderRadius as number}px` : undefined
    const taPad = props.padding !== undefined ? `${props.padding as number}px` : undefined
    const taFontSize = (props.fontSize as string) || undefined
    const taFontWeight = (props.fontWeight as string) || undefined
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
          backgroundColor: taBg || undefined,
          borderColor: taBorder || undefined,
          color: taText || undefined,
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
              ...bgStyle((props.bgColor as string) || undefined),
              color: (props.textColor as string) || undefined,
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
    const bcLinkColor = (props.linkColor as string) || 'var(--primary)'
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
                <BreadcrumbLink style={{ color: bcLinkColor || 'var(--primary)' }}>{item}</BreadcrumbLink>
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
    const bgActiveColor = (props.activeColor as string) || 'var(--primary)'
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
                borderColor: isActive ? (bgActiveColor ?? CSS_PRIMARY) : bgBorderColor,
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
    const sbBg = (props.bgColor as string) || undefined
    const sbActiveColor = (props.activeColor as string) ?? undefined
    const sbBorderColor = (props.borderColor as string) || undefined
    const sbTextColor = (props.textColor as string) || undefined
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
                      ? (sbActiveColor ? `${sbActiveColor}22` : 'color-mix(in oklch, var(--primary) 10%, transparent)')
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
    const barColor = (props.barColor as string) ?? 'var(--primary)'
    const bar2Color = (props.bar2Color as string) || '#94a3b8'
    const gridColor = (props.gridColor as string) || undefined
    const bgColor = (props.bgColor as string) || undefined
    const showGrid = (props.showGrid as boolean) ?? false
    const showSecondSeries = (props.showSecondSeries as boolean) ?? false
    const series1Label = (props.series1Label as string) ?? 'Series 1'
    const series2Label = (props.series2Label as string) ?? 'Series 2'
    const isHorizontal = barLayout === 'horizontal'
    return (
      <div className="flex items-center justify-center w-full">
        <div className="w-[520px] max-w-full h-[260px] rounded-lg overflow-hidden" style={{ ...bgStyle(bgColor) }}>
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
    const lineColor = (props.lineColor as string) ?? 'var(--primary)'
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
        <div className="w-[520px] max-w-full h-[260px]">
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

// ─── Colors panel ─────────────────────────────────────────────────────────────

function ColorsPanel({
  tokens,
  onTokenChange,
  activePresetName,
  onApplyPreset,
}: {
  tokens: SemanticTokens
  onTokenChange: (key: SemanticTokenKey, value: string) => void
  activePresetName: string
  onApplyPreset: (preset: TokenPreset) => void
}) {
  const [editingKey, setEditingKey] = useState<SemanticTokenKey | null>(null)
  const [colorSearch, setColorSearch] = useState('')

  const q = colorSearch.trim().toLowerCase()

  // Filter token groups by search
  const filteredTokenGroups = q
    ? TOKEN_GROUPS.map(g => ({ ...g, keys: g.keys.filter(k => TOKEN_LABELS[k].toLowerCase().includes(q)) })).filter(g => g.keys.length > 0)
    : TOKEN_GROUPS

  // Filter Tailwind families by name or shade number
  const filteredTailwind: TailwindFamily[] = q
    ? TAILWIND_PALETTE.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.shades.some(s => `${f.name.toLowerCase()}-${s.shade}`.includes(q) || String(s.shade).startsWith(q))
      )
    : TAILWIND_PALETTE

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <Input
          placeholder="Search colors..."
          value={colorSearch}
          onChange={(e) => setColorSearch(e.target.value)}
          className="h-7 text-xs rounded-md"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Design Tokens ─────────────────────────────── */}
        {filteredTokenGroups.length > 0 && (
          <>
            {/* Preset strip */}
            {!q && (
              <div className="px-3 pt-2 pb-3 border-b border-border/40">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {TOKEN_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => onApplyPreset(preset)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs cursor-pointer transition-colors',
                        activePresetName === preset.name
                          ? 'bg-accent/15 border-accent/30 text-foreground'
                          : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="flex gap-0.5">
                        {preset.swatchColors.map((c, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
                        ))}
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-3 pt-4 pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Design Tokens</p>
            </div>

            {/* Token rows */}
            <div className="py-1">
              {filteredTokenGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  {group.keys.map((key) => (
                    <div key={key} className="relative" data-health-id={`token:${key}`}>
                      <div className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 group">
                        <div
                          className="w-6 h-6 rounded-md border border-border shrink-0 cursor-pointer"
                          style={{ backgroundColor: tokens[key], boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
                          onClick={() => setEditingKey(editingKey === key ? null : key)}
                        />
                        <span className="text-xs text-foreground flex-1 truncate">{TOKEN_LABELS[key]}</span>
                        <button
                          onClick={() => setEditingKey(editingKey === key ? null : key)}
                          className="text-[10px] font-mono text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors opacity-0 group-hover:opacity-100 truncate max-w-[80px]"
                        >
                          Edit
                        </button>
                      </div>

                      {editingKey === key && (
                        <div className="mx-3 mb-2 p-2 rounded-lg border border-border bg-muted/30">
                          <div className="flex flex-wrap gap-1">
                            {CURATED_COLORS.map((color) => (
                              <button
                                key={color.oklch}
                                title={color.label}
                                onClick={() => { onTokenChange(key, color.oklch); setEditingKey(null) }}
                                className={cn(
                                  'w-5 h-5 rounded-sm cursor-pointer transition-all hover:scale-110',
                                  tokens[key] === color.oklch && 'ring-2 ring-offset-1 ring-foreground',
                                )}
                                style={{ backgroundColor: color.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Tailwind Colors ────────────────────────────── */}
        {filteredTailwind.length > 0 && (
          <>
            <div className="px-3 pt-5 pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Tailwind Colors</p>
            </div>

            <div className="py-2 pb-4">
              {filteredTailwind.map((family) => (
                <div key={family.name} className="flex items-center gap-2 px-3 py-1 group hover:bg-muted/30">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{family.name}</span>
                  <div className="flex gap-0.5 flex-1">
                    {family.shades.map(({ shade, hex }) => (
                      <button
                        key={shade}
                        title={`${family.name} ${shade} · ${hex}`}
                        onClick={() => {
                          if (editingKey) {
                            onTokenChange(editingKey, hexToOklch(hex))
                            setEditingKey(null)
                          }
                        }}
                        className={cn(
                          'flex-1 h-5 rounded-sm transition-all',
                          editingKey ? 'cursor-pointer hover:scale-y-125 hover:rounded-none' : 'cursor-default',
                        )}
                        style={{ backgroundColor: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {filteredTokenGroups.length === 0 && filteredTailwind.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No colors match "{colorSearch}"</p>
        )}
      </div>
    </div>
  )
}

// ─── Variants preview ────────────────────────────────────────────────────────

function VariantsPreview({
  name,
  rawProps,
  globalRadius,
}: {
  name: string
  rawProps: ComponentProps
  globalRadius: number
}) {
  const config = COMPONENT_VARIANTS[name]

  // No variants config → fall back to nothing (caller shows single preview)
  if (!config) return null

  // Noop: variant previews must not mutate inspector state
  const noop: UpdateProp = () => {}

  const variantBuckets = (rawProps._variantProps as Record<string, ComponentProps> | undefined) ?? {}

  return (
    <div className="flex flex-wrap gap-10 justify-center p-10 w-full">
      {config.values.map((value) => {
        // Merge global props + this variant's scoped overrides
        const bucket = variantBuckets[String(value)] ?? {}
        const merged = { ...rawProps, ...bucket, [config.prop]: value }
        return (
          <div key={String(value)} className="flex flex-col items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
              {String(value)}
            </span>
            <ComponentPreview
              name={name}
              props={merged}
              updateProp={noop}
              globalRadius={globalRadius}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── States preview ───────────────────────────────────────────────────────────

function StatesPreview({
  name,
  rawProps,
  globalRadius,
}: {
  name: string
  rawProps: ComponentProps
  globalRadius: number
}) {
  const states = COMPONENT_STATES[name]
  if (!states) return null
  const noop: UpdateProp = () => {}
  const variantBuckets = (rawProps._variantProps as Record<string, ComponentProps> | undefined) ?? {}
  return (
    <div className="flex flex-wrap gap-10 justify-center p-10 w-full">
      {states.map((state) => {
        // Determine the variant for this state entry
        const stateVariant = (state.propsOverride.variant as string) ?? (rawProps.variant as string) ?? 'default'
        const bucket = variantBuckets[stateVariant] ?? {}
        const merged = { ...rawProps, ...bucket, ...state.propsOverride }
        return (
          <div key={state.label} className="flex flex-col items-center gap-3">
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
              {state.label}
            </span>
            <ComponentPreview
              name={name}
              props={merged}
              updateProp={noop}
              globalRadius={globalRadius}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Design System Health ─────────────────────────────────────────────────────

function parseOklchL(value: string): number | null {
  const m = value.match(/oklch\(\s*([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

const COLOR_FIELDS_TO_CHECK = [
  'bgColor', 'textColor', 'borderColor', 'activeColor', 'inactiveColor',
  'activeTextColor', 'trackColor', 'indicatorColor', 'linkColor', 'separatorColor',
]

function analyzeDesignSystem(
  tokens: SemanticTokens,
  allComponentProps: Record<string, ComponentProps>,
  globalRadius: number,
): HealthReport {
  const issues: HealthIssue[] = []

  // A. Too many custom color overrides
  const customOverrideComponents: string[] = []
  for (const [comp, props] of Object.entries(allComponentProps)) {
    const hasCustom = COLOR_FIELDS_TO_CHECK.some((f) => {
      const v = props[f] as string | undefined
      return v && v !== '' && !v.startsWith('var(--')
    })
    if (hasCustom) customOverrideComponents.push(comp)
  }
  if (customOverrideComponents.length >= 3) {
    issues.push({
      id: 'custom-overrides',
      level: 'warning',
      title: `${customOverrideComponents.length} components use custom color overrides`,
      description: 'Consider using semantic tokens for better consistency across themes.',
      target: { type: 'component', name: customOverrideComponents[0] },
    })
  }

  // B. Radius inconsistency
  for (const [comp, props] of Object.entries(allComponentProps)) {
    if (typeof props.borderRadius === 'number' && props.borderRadius !== globalRadius) {
      issues.push({
        id: `radius:${comp}`,
        level: 'warning',
        title: `${comp} radius differs from global radius`,
        description: `${comp} uses ${props.borderRadius}px; global is ${globalRadius}px.`,
        target: { type: 'component', name: comp, field: 'borderRadius' },
      })
    }
  }

  // C. Customized tokens not explicitly bound to any component
  const usedTokenKeys = new Set<string>()
  for (const props of Object.values(allComponentProps)) {
    for (const v of Object.values(props)) {
      if (typeof v === 'string' && v.startsWith('var(--')) {
        for (const key of TOKEN_KEYS) {
          if (v === `var(${TOKEN_CSS_VARS[key]})`) usedTokenKeys.add(key)
        }
      }
    }
  }
  const importantTokens: SemanticTokenKey[] = ['accent', 'secondary', 'destructive']
  for (const key of importantTokens) {
    if (tokens[key] !== DEFAULT_TOKENS[key] && !usedTokenKeys.has(key)) {
      issues.push({
        id: `unused-token:${key}`,
        level: 'warning',
        title: `${TOKEN_LABELS[key]} token customized but not used`,
        description: 'This token has been modified but no component is explicitly bound to it.',
        target: { type: 'token', name: key },
      })
    }
  }

  // D. Background set without foreground pairing
  for (const [comp, props] of Object.entries(allComponentProps)) {
    const bg = props.bgColor as string | undefined
    const text = props.textColor as string | undefined
    if (bg && bg !== '' && (!text || text === '')) {
      issues.push({
        id: `pairing:${comp}`,
        level: 'warning',
        title: `${comp} background set without text color`,
        description: 'Custom background may not pair well with the default foreground.',
        target: { type: 'component', name: comp, field: 'textColor' },
      })
    }
  }

  // E. Basic contrast check for key token pairs (OKLCH lightness delta)
  const contrastPairs: [SemanticTokenKey, SemanticTokenKey][] = [
    ['primary', 'primaryForeground'],
    ['destructive', 'destructiveForeground'],
    ['background', 'foreground'],
    ['card', 'cardForeground'],
  ]
  for (const [bgKey, fgKey] of contrastPairs) {
    const bgL = parseOklchL(tokens[bgKey])
    const fgL = parseOklchL(tokens[fgKey])
    if (bgL !== null && fgL !== null && Math.abs(bgL - fgL) < 0.4) {
      issues.push({
        id: `contrast:${bgKey}`,
        level: 'error',
        title: `Low contrast: ${TOKEN_LABELS[bgKey]} vs ${TOKEN_LABELS[fgKey]}`,
        description: `Lightness difference is ${Math.abs(bgL - fgL).toFixed(2)} — increase contrast for accessibility.`,
        target: { type: 'token', name: bgKey },
      })
    }
  }

  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.filter((i) => i.level === 'warning').length
  const status: HealthReport['status'] = errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'healthy'
  return { status, issues, summary: { errors, warnings } }
}

function IssueRow({ issue, onNavigate }: { issue: HealthIssue; onNavigate: (issue: HealthIssue) => void }) {
  const clickable = !!issue.target
  return (
    <button
      onClick={() => clickable && onNavigate(issue)}
      disabled={!clickable}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
        issue.level === 'error'
          ? 'border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20'
          : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20',
        clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-px">
          {issue.level === 'error' ? <IconError size={14} /> : <IconWarning size={14} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{issue.title}</p>
          {issue.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{issue.description}</p>
          )}
          {clickable && (
            <p className="text-[10px] text-muted-foreground/40 mt-1">Click to navigate</p>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Export Sheet ─────────────────────────────────────────────────────────────

function ExportSheet({
  open,
  onOpenChange,
  component,
  props,
  globalRadius,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  component: string
  props: ComponentProps
  globalRadius: number
}) {
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedUsage, setCopiedUsage] = useState(false)

  const { full, usage } = generateTSX(component, props)

  // ── Design system health checks ──────────────────────────────────────────
  const hasCustomRadius  = typeof props.borderRadius === 'number'
  const radiusOk         = !hasCustomRadius || (props.borderRadius as number) === globalRadius
  const colorOverrides   = ['bgColor', 'textColor', 'borderColor'].filter(k => !!props[k])
  const tokensOk         = colorOverrides.length === 0
  const variantsOk       = !!COMPONENT_VARIANTS[component]
  const contentFields    = ['label', 'title', 'description', 'placeholder']
  const contentOk        = contentFields.every(f => !Object.prototype.hasOwnProperty.call(props, f) || !!(props[f] as string)?.trim())
  const healthChecks: { label: string; pass: boolean; note?: string }[] = [
    { label: 'Radius consistent with global radius', pass: radiusOk,   note: radiusOk ? undefined : `Custom radius ${props.borderRadius}px — global is ${globalRadius}px` },
    { label: 'No inline color overrides',            pass: tokensOk,   note: tokensOk ? undefined : `Overridden: ${colorOverrides.join(', ')}` },
    { label: 'Variant coverage available',           pass: variantsOk, note: variantsOk ? undefined : 'No variants registered for this component' },
    { label: 'Required content fields filled',       pass: contentOk,  note: contentOk ? undefined : 'One or more text fields are empty' },
  ]

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
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Export {component}</SheetTitle>
          <SheetDescription>
            Copy this into your codebase. It uses your configured props and shadcn primitives.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
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

          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Design System Health</p>
            <div className="flex flex-col gap-2">
              {healthChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-2">
                  <span className="shrink-0 mt-px">
                    {check.pass ? <IconSuccess size={14} /> : <IconWarning size={14} />}
                  </span>
                  <div className="min-w-0">
                    <span className={cn('text-xs', check.pass ? 'text-foreground/70' : 'text-foreground')}>
                      {check.label}
                    </span>
                    {!check.pass && check.note && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{check.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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

  // Semantic color tokens — source of truth for all CSS vars
  const [semanticTokens, setSemanticTokens] = useState<SemanticTokens>(() => {
    if (!projectId) return DEFAULT_TOKENS
    try {
      const stored = localStorage.getItem(`blox_tokens_${projectId}`)
      if (stored) return JSON.parse(stored) as SemanticTokens
    } catch { /* fall through */ }
    return DEFAULT_TOKENS
  })

  useProjectTokens(semanticTokens, paletteColors)

  // Re-inject tokens whenever they change (after mount)
  useEffect(() => {
    injectSemanticTokens(semanticTokens)
  }, [semanticTokens])

  // Persist tokens to localStorage
  useEffect(() => {
    if (!projectId) return
    localStorage.setItem(`blox_tokens_${projectId}`, JSON.stringify(semanticTokens))
  }, [semanticTokens, projectId])

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
  const [leftPanelView, setLeftPanelView] = useState<'components' | 'colors'>('components')
  const [activePresetName, setActivePresetName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewMode, setPreviewMode] = useState<'single' | 'variants' | 'states'>('single')
  const [zoomLevel, setZoomLevel] = useState(100)
  const [showGradientHandles, setShowGradientHandles] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [activeThemeId, setActiveThemeId] = useState(projectId ?? '')
  const [activeDots, setActiveDots] = useState(paletteColors)
  const { isDark, toggleTheme } = useTheme()

  // ─── Reset all project customizations to the neutral default shadcn baseline ──
  // Single canonical source of truth: TOKEN_PRESETS[0] ('Default' neutral preset)
  function resetCurrentProject() {
    const defaultPreset = TOKEN_PRESETS[0]
    setSemanticTokens(defaultPreset.tokens)
    injectSemanticTokens(defaultPreset.tokens)
    setAllComponentProps({})
    setProjectSettings({ globalRadius: 6 })
    setActivePresetName(defaultPreset.name)
    setActiveDots(defaultPreset.swatchColors)
    setActivePrimaryColor(defaultPreset.swatchColors[0])
    setActiveThemeId(defaultPreset.name)
    setResetConfirmOpen(false)
  }

  const healthReport = useMemo(
    () => analyzeDesignSystem(semanticTokens, allComponentProps, projectSettings.globalRadius),
    [semanticTokens, allComponentProps, projectSettings.globalRadius],
  )

  function handleIssueClick(issue: HealthIssue) {
    setHealthOpen(false)
    if (!issue.target) return
    const { type, name } = issue.target
    if (type === 'component') {
      setSelectedComponent(name)
      setLeftPanelView('components')
    } else if (type === 'token') {
      setLeftPanelView('colors')
    }
    const hid = type === 'token' ? `token:${name}` : `component:${name}`
    setHighlightId(hid)
    setTimeout(() => setHighlightId(null), 2000)
  }

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-health-id="${highlightId}"]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        el.classList.add('health-pulse')
        const clear = setTimeout(() => el.classList.remove('health-pulse'), 1600)
        return () => clearTimeout(clear)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [highlightId])

  function applyPreset(preset: TokenPreset) {
    setSemanticTokens(preset.tokens)
    injectSemanticTokens(preset.tokens)
    setActiveThemeId(preset.name)
    setActivePresetName(preset.name)
    setActiveDots(preset.swatchColors)
    setActivePrimaryColor(preset.swatchColors[0])
    setThemeOpen(false)
    setAllComponentProps(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(comp => {
        next[comp] = { ...next[comp], bgColor: undefined, textColor: undefined, _variantProps: undefined }
      })
      return next
    })
  }

  function applyProjectPalette(p: Project) {
    const primary = hexToOklch(p.primaryColor)
    const updated = { ...semanticTokens, primary, primaryForeground: 'oklch(0.985 0 0)' }
    setSemanticTokens(updated)
    injectSemanticTokens(updated)
    setActiveThemeId(p.id)
    setActivePresetName('')
    setActiveDots(p.colors)
    setActivePrimaryColor(p.primaryColor)
    setThemeOpen(false)
    setAllComponentProps(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(comp => {
        next[comp] = { ...next[comp], bgColor: undefined, textColor: undefined, _variantProps: undefined }
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

  useEffect(() => {
    if (!projectId) return
    localStorage.setItem(`blox_active_dots_${projectId}`, JSON.stringify(activeDots))
  }, [activeDots, projectId])

  const currentProps: ComponentProps = (() => {
    if (!selectedComponent) return {}
    const globalProps = allComponentProps[selectedComponent] ?? {}
    const currentVariant = (globalProps.variant as string) ?? 'default'
    const variantBucket = (globalProps._variantProps as Record<string, ComponentProps> | undefined)?.[currentVariant] ?? {}
    // Merge: global props first, then variant-scoped overrides on top
    return { ...globalProps, ...variantBucket }
  })()

  const updateProp: UpdateProp = (key, value) => {
    if (!selectedComponent) return
    if (VARIANT_SCOPED_PROPS.has(key)) {
      // Write color overrides into a per-variant sub-object so they don't
      // bleed across variants when the user switches the variant selector.
      setAllComponentProps((prev) => {
        const compProps = prev[selectedComponent] ?? {}
        const currentVariant = (compProps.variant as string) ?? 'default'
        const existing = (compProps._variantProps as Record<string, ComponentProps> | undefined) ?? {}
        return {
          ...prev,
          [selectedComponent]: {
            ...compProps,
            _variantProps: {
              ...existing,
              [currentVariant]: {
                ...(existing[currentVariant] ?? {}),
                [key]: value,
              },
            },
          },
        }
      })
    } else {
      setAllComponentProps((prev) => ({
        ...prev,
        [selectedComponent]: {
          ...(prev[selectedComponent] ?? {}),
          [key]: value,
        },
      }))
    }
  }

  // Reset to single preview when switching components
  useEffect(() => {
    setPreviewMode('single')
    setZoomLevel(100)
    setShowGradientHandles(false)
  }, [selectedComponent])

  // Show gradient handles when bgColor becomes a gradient, hide when it's not
  const bgIsGradient = typeof currentProps.bgColor === 'string' && currentProps.bgColor.startsWith('linear-gradient')
  useEffect(() => {
    if (bgIsGradient) setShowGradientHandles(true)
    else setShowGradientHandles(false)
  }, [bgIsGradient])

  // Escape key hides gradient handles
  useEffect(() => {
    if (!showGradientHandles) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowGradientHandles(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showGradientHandles])

  const ZOOM_STEPS = [75, 100, 125, 150]
  const zoomIn  = () => setZoomLevel(z => ZOOM_STEPS[Math.min(ZOOM_STEPS.indexOf(z) + 1, ZOOM_STEPS.length - 1)] ?? z)
  const zoomOut = () => setZoomLevel(z => ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(z) - 1, 0)] ?? z)

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
            <button onClick={() => navigate('/')} className="shrink-0 flex items-center mr-2">
              <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-4 dark:hidden" />
              <img src="/Blox-Full-Logo-Dark-Mode.svg" alt="Blox" className="h-4 hidden dark:block" />
            </button>
            <span className="text-muted-foreground/30 text-sm shrink-0">/</span>
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
                          onClick={() => applyProjectPalette(p)}
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
                  {TOKEN_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md w-full text-left transition-colors cursor-pointer border',
                        activeThemeId === preset.name
                          ? 'bg-accent/15 border-accent/30'
                          : 'hover:bg-muted border-transparent',
                      )}
                    >
                      <div className="flex gap-1 shrink-0">
                        {preset.swatchColors.map((c, i) => (
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
            {(() => {
              const healthTip = healthReport.status === 'healthy'
                ? 'Design system healthy — ready for export'
                : healthReport.status === 'warning'
                ? `${healthReport.summary.warnings} warning${healthReport.summary.warnings !== 1 ? 's' : ''} — needs attention`
                : `${healthReport.summary.errors} error${healthReport.summary.errors !== 1 ? 's' : ''} detected`
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setHealthOpen(true)}
                      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer hover:bg-muted"
                    >
                      {healthReport.status === 'error' ? <IconError size={16} /> : healthReport.status === 'warning' ? <IconWarning size={16} /> : <IconSuccess size={16} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{healthTip}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })()}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  {isDark ? <Sun size={14} strokeWidth={1.75} /> : <Moon size={14} strokeWidth={1.75} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isDark ? 'Light mode' : 'Dark mode'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setResetConfirmOpen(true)}
                  className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset all changes</p>
              </TooltipContent>
            </Tooltip>
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
          <aside className="w-[260px] border-r border-border flex flex-col h-full">
            {/* Panel nav */}
            <div className="shrink-0 px-2 py-2 border-b border-border/40">
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
              {(['components', 'colors'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setLeftPanelView(view)}
                  className={cn(
                    'flex-1 py-1.5 text-xs capitalize cursor-pointer transition-all rounded-md',
                    leftPanelView === view
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {view}
                </button>
              ))}
              </div>
            </div>

            {leftPanelView === 'components' ? (
              <>
                <div className="px-3 py-2 shrink-0">
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 text-xs rounded-md"
                  />
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {filteredComponents.map((name) => (
                    <button
                      key={name}
                      data-health-id={`component:${name}`}
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
              </>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ColorsPanel
                  tokens={semanticTokens}
                  onTokenChange={(key, value) => setSemanticTokens(prev => ({ ...prev, [key]: value }))}
                  activePresetName={activePresetName}
                  onApplyPreset={(preset) => {
                    applyPreset(preset)
                    setThemeOpen(false)
                  }}
                />
              </div>
            )}
          </aside>

          {/* ── Canvas ── */}
          <main
            onPointerDown={() => setShowGradientHandles(false)}
            className={cn(
            'flex-1 relative bg-background',
            previewMode === 'variants' || previewMode === 'states'
              ? 'overflow-y-auto'
              : 'overflow-hidden flex items-center justify-center',
          )}>
            {/* Floating preview controls — top-right */}
            {selectedComponent && (
              <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground/50 font-mono select-none">
                  {previewMode === 'single' && 'Configured component'}
                  {previewMode === 'variants' && COMPONENT_VARIANTS[selectedComponent] && (
                    <>{COMPONENT_VARIANTS[selectedComponent].values.length} variants</>
                  )}
                  {previewMode === 'states' && COMPONENT_STATES[selectedComponent] && (
                    <>{COMPONENT_STATES[selectedComponent].length} states</>
                  )}
                </span>
                {(COMPONENT_VARIANTS[selectedComponent] || COMPONENT_STATES[selectedComponent]) && (
                  <div className="flex items-center rounded-lg border border-border bg-background/80 backdrop-blur-sm shadow-sm overflow-hidden text-xs">
                    {(
                      [
                        'single',
                        ...(COMPONENT_VARIANTS[selectedComponent] ? ['variants'] : []),
                        ...(COMPONENT_STATES[selectedComponent]  ? ['states']   : []),
                      ] as ('single' | 'variants' | 'states')[]
                    ).map((mode, i) => (
                      <button
                        key={mode}
                        onClick={() => setPreviewMode(mode)}
                        className={cn(
                          'px-3 py-1.5 capitalize cursor-pointer transition-colors',
                          i > 0 && 'border-l border-border',
                          previewMode === mode
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Safe area + zoom wrapper */}
            {selectedComponent ? (
              <div className={cn(
                'w-full p-12',
                previewMode === 'variants' || previewMode === 'states'
                  ? 'min-h-full flex items-center justify-center'
                  : 'h-full flex items-center justify-center',
              )}>
                <div
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                  className={cn(
                    previewMode === 'variants' || previewMode === 'states'
                      ? 'w-full'
                      : '',
                  )}
                >
                  {previewMode === 'variants' && COMPONENT_VARIANTS[selectedComponent] ? (
                    <VariantsPreview
                      name={selectedComponent}
                      rawProps={allComponentProps[selectedComponent] ?? {}}
                      globalRadius={projectSettings.globalRadius}
                    />
                  ) : previewMode === 'states' && COMPONENT_STATES[selectedComponent] ? (
                    <StatesPreview
                      name={selectedComponent}
                      rawProps={allComponentProps[selectedComponent] ?? {}}
                      globalRadius={projectSettings.globalRadius}
                    />
                  ) : (
                    <div
                      className="relative inline-flex items-center justify-center"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        if (bgIsGradient) setShowGradientHandles(true)
                      }}
                    >
                      <ComponentPreview
                        name={selectedComponent}
                        props={currentProps}
                        updateProp={updateProp}
                        globalRadius={projectSettings.globalRadius}
                      />
                      {showGradientHandles && bgIsGradient && (
                        <GradientHandleOverlay
                          gradient={currentProps.bgColor as string}
                          onUpdate={(g) => updateProp('bgColor', g)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <LayoutGrid size={40} strokeWidth={1} className="text-muted-foreground/25" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground/60">No component selected</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Pick a component from the left panel to preview and configure it.</p>
                </div>
              </div>
            )}

            {/* Floating zoom controls — bottom-right, outside safe area */}
            {selectedComponent && (
              <div className="absolute bottom-4 right-4 z-10 flex items-center gap-px rounded-md border border-border bg-background/90 backdrop-blur-sm overflow-hidden">
                <button
                  onClick={zoomOut}
                  disabled={zoomLevel === ZOOM_STEPS[0]}
                  className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Minus size={12} />
                </button>
                <span className="text-[11px] font-mono text-muted-foreground px-1.5 tabular-nums min-w-[36px] text-center select-none">
                  {zoomLevel}%
                </span>
                <button
                  onClick={zoomIn}
                  disabled={zoomLevel === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </main>

          {/* ── Right panel — Inspector ── */}
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-background overflow-hidden">
            {/* Sticky header */}
            <div className="shrink-0 border-b border-border/40 px-4 pt-4 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
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
                {selectedComponent && (
                  <button
                    onClick={() => setAllComponentProps(prev => ({ ...prev, [selectedComponent]: {} }))}
                    className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors shrink-0 mt-0.5"
                  >
                    Reset
                  </button>
                )}
              </div>
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
          globalRadius={projectSettings.globalRadius}
        />
      )}

      {/* ── Design System Health dialog ── */}
      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent className="max-w-[480px] flex flex-col p-0 max-h-[80vh]">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              {healthReport.status === 'error' ? <IconError size={16} className="shrink-0" /> : healthReport.status === 'warning' ? <IconWarning size={16} className="shrink-0" /> : <IconSuccess size={16} className="shrink-0" />}
              <DialogTitle>Design System Health</DialogTitle>
            </div>
            <DialogDescription>
              {healthReport.status === 'healthy'
                ? 'No issues found. Your design system is consistent.'
                : [
                    healthReport.summary.errors > 0 && `${healthReport.summary.errors} error${healthReport.summary.errors !== 1 ? 's' : ''}`,
                    healthReport.summary.warnings > 0 && `${healthReport.summary.warnings} warning${healthReport.summary.warnings !== 1 ? 's' : ''}`,
                  ].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-5 py-4">
              {healthReport.status === 'healthy' ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <IconSuccess size={36} className="opacity-50" />
                  <div>
                    <p className="text-sm font-medium text-foreground">All checks passed</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your design system is consistent and ready for export.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {healthReport.issues.filter((i) => i.level === 'error').length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Errors</p>
                      <div className="flex flex-col gap-1.5">
                        {healthReport.issues
                          .filter((i) => i.level === 'error')
                          .map((issue) => (
                            <IssueRow key={issue.id} issue={issue} onNavigate={handleIssueClick} />
                          ))}
                      </div>
                    </div>
                  )}
                  {healthReport.issues.filter((i) => i.level === 'warning').length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Warnings</p>
                      <div className="flex flex-col gap-1.5">
                        {healthReport.issues
                          .filter((i) => i.level === 'warning')
                          .map((issue) => (
                            <IssueRow key={issue.id} issue={issue} onNavigate={handleIssueClick} />
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="px-5 py-3 border-t border-border shrink-0">
            <Button variant="outline" className="w-full" size="sm" onClick={() => setHealthOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset confirmation dialog ── */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset all changes?</DialogTitle>
            <DialogDescription>
              This will remove all token edits, component customizations, and project-level styling changes for this design system and restore the default neutral shadcn preset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetCurrentProject}>
              Reset all changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
