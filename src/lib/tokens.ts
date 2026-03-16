// ─── Semantic color token system ─────────────────────────────────────────────
//
// Values are full CSS color strings (OKLCH format, matching this project's
// Tailwind v4 + OKLCH setup). Always use var(--token) directly — never wrap
// in hsl() or rgb().

export type SemanticTokenKey =
  | 'primary' | 'primaryForeground'
  | 'background' | 'foreground'
  | 'card' | 'cardForeground'
  | 'popover' | 'popoverForeground'
  | 'secondary' | 'secondaryForeground'
  | 'muted' | 'mutedForeground'
  | 'accent' | 'accentForeground'
  | 'border' | 'input' | 'ring'
  | 'destructive' | 'destructiveForeground'

export type SemanticTokens = Record<SemanticTokenKey, string>

export const TOKEN_KEYS: SemanticTokenKey[] = [
  'primary', 'primaryForeground',
  'background', 'foreground',
  'card', 'cardForeground',
  'popover', 'popoverForeground',
  'secondary', 'secondaryForeground',
  'muted', 'mutedForeground',
  'accent', 'accentForeground',
  'border', 'input', 'ring',
  'destructive', 'destructiveForeground',
]

export const TOKEN_LABELS: Record<SemanticTokenKey, string> = {
  primary:               'Primary',
  primaryForeground:     'Primary Foreground',
  background:            'Background',
  foreground:            'Foreground',
  card:                  'Card',
  cardForeground:        'Card Foreground',
  popover:               'Popover',
  popoverForeground:     'Popover Foreground',
  secondary:             'Secondary',
  secondaryForeground:   'Secondary Foreground',
  muted:                 'Muted',
  mutedForeground:       'Muted Foreground',
  accent:                'Accent',
  accentForeground:      'Accent Foreground',
  border:                'Border',
  input:                 'Input',
  ring:                  'Ring',
  destructive:           'Destructive',
  destructiveForeground: 'Destructive Foreground',
}

// Maps token key → CSS variable name
export const TOKEN_CSS_VARS: Record<SemanticTokenKey, string> = {
  primary:               '--primary',
  primaryForeground:     '--primary-foreground',
  background:            '--background',
  foreground:            '--foreground',
  card:                  '--card',
  cardForeground:        '--card-foreground',
  popover:               '--popover',
  popoverForeground:     '--popover-foreground',
  secondary:             '--secondary',
  secondaryForeground:   '--secondary-foreground',
  muted:                 '--muted',
  mutedForeground:       '--muted-foreground',
  accent:                '--accent',
  accentForeground:      '--accent-foreground',
  border:                '--border',
  input:                 '--input',
  ring:                  '--ring',
  destructive:           '--destructive',
  destructiveForeground: '--destructive-foreground',
}

// Token group definitions for the Colors page UI
export type TokenGroup = { label: string; keys: SemanticTokenKey[] }
export const TOKEN_GROUPS: TokenGroup[] = [
  { label: 'Brand',       keys: ['primary', 'primaryForeground'] },
  { label: 'Base',        keys: ['background', 'foreground'] },
  { label: 'Surface',     keys: ['card', 'cardForeground', 'popover', 'popoverForeground'] },
  { label: 'Neutral',     keys: ['secondary', 'secondaryForeground', 'muted', 'mutedForeground', 'accent', 'accentForeground'] },
  { label: 'System',      keys: ['border', 'input', 'ring'] },
  { label: 'Destructive', keys: ['destructive', 'destructiveForeground'] },
]

// ─── Injection ───────────────────────────────────────────────────────────────

export function injectSemanticTokens(tokens: SemanticTokens): void {
  const root = document.documentElement
  for (const key of TOKEN_KEYS) {
    root.style.setProperty(TOKEN_CSS_VARS[key], tokens[key])
  }
}

export function clearSemanticTokens(): void {
  const root = document.documentElement
  for (const key of TOKEN_KEYS) {
    root.style.removeProperty(TOKEN_CSS_VARS[key])
  }
}

// ─── Hex → OKLCH conversion ──────────────────────────────────────────────────

export function hexToOklch(hex: string): string {
  const clean = hex.replace('#', '')
  let r = parseInt(clean.slice(0, 2), 16) / 255
  let g = parseInt(clean.slice(2, 4), 16) / 255
  let b = parseInt(clean.slice(4, 6), 16) / 255

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z)

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  const C = Math.sqrt(a * a + bVal * bVal)
  const h = Math.atan2(bVal, a) * 180 / Math.PI
  const hue = h < 0 ? h + 360 : h

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${hue.toFixed(3)})`
}

// ─── Default theme ───────────────────────────────────────────────────────────
// Mirrors the :root values in src/index.css

export const DEFAULT_TOKENS: SemanticTokens = {
  primary:               'oklch(0.205 0 0)',
  primaryForeground:     'oklch(0.985 0 0)',
  background:            'oklch(1 0 0)',
  foreground:            'oklch(0.145 0 0)',
  card:                  'oklch(1 0 0)',
  cardForeground:        'oklch(0.145 0 0)',
  popover:               'oklch(1 0 0)',
  popoverForeground:     'oklch(0.145 0 0)',
  secondary:             'oklch(0.97 0 0)',
  secondaryForeground:   'oklch(0.205 0 0)',
  muted:                 'oklch(0.97 0 0)',
  mutedForeground:       'oklch(0.556 0 0)',
  accent:                'oklch(0.97 0 0)',
  accentForeground:      'oklch(0.205 0 0)',
  border:                'oklch(0.922 0 0)',
  input:                 'oklch(0.922 0 0)',
  ring:                  'oklch(0.708 0 0)',
  destructive:           'oklch(0.577 0.245 27.325)',
  destructiveForeground: 'oklch(0.985 0 0)',
}

// ─── Token presets ────────────────────────────────────────────────────────────

export type TokenPreset = {
  name: string
  tokens: SemanticTokens
  swatchColors: [string, string, string]
}

function makeTokens(primary: string, ring: string): SemanticTokens {
  return {
    primary,
    primaryForeground:     'oklch(0.985 0 0)',
    background:            'oklch(1 0 0)',
    foreground:            'oklch(0.145 0 0)',
    card:                  'oklch(1 0 0)',
    cardForeground:        'oklch(0.145 0 0)',
    popover:               'oklch(1 0 0)',
    popoverForeground:     'oklch(0.145 0 0)',
    secondary:             'oklch(0.97 0 0)',
    secondaryForeground:   'oklch(0.205 0 0)',
    muted:                 'oklch(0.97 0 0)',
    mutedForeground:       'oklch(0.556 0 0)',
    accent:                'oklch(0.97 0 0)',
    accentForeground:      'oklch(0.205 0 0)',
    border:                'oklch(0.922 0 0)',
    input:                 'oklch(0.922 0 0)',
    ring,
    destructive:           'oklch(0.577 0.245 27.325)',
    destructiveForeground: 'oklch(0.985 0 0)',
  }
}

export const TOKEN_PRESETS: TokenPreset[] = [
  {
    name: 'Default',
    swatchColors: ['#18181b', '#71717a', '#e4e4e7'],
    tokens: { ...DEFAULT_TOKENS },
  },
  {
    name: 'Zinc',
    swatchColors: ['#3f3f46', '#71717a', '#d4d4d8'],
    tokens: makeTokens('oklch(0.352 0 0)', 'oklch(0.600 0 0)'),
  },
  {
    name: 'Slate',
    swatchColors: ['#1e293b', '#64748b', '#cbd5e1'],
    tokens: makeTokens('oklch(0.298 0.036 264)', 'oklch(0.600 0.025 264)'),
  },
  {
    name: 'Stone',
    swatchColors: ['#1c1917', '#78716c', '#d6d3d1'],
    tokens: makeTokens('oklch(0.268 0.008 75)', 'oklch(0.600 0.006 75)'),
  },
  {
    name: 'Blue',
    swatchColors: ['#2563eb', '#3b82f6', '#93c5fd'],
    tokens: makeTokens('oklch(0.546 0.245 264)', 'oklch(0.650 0.160 264)'),
  },
  {
    name: 'Violet',
    swatchColors: ['#7c3aed', '#8b5cf6', '#c4b5fd'],
    tokens: makeTokens('oklch(0.491 0.270 292)', 'oklch(0.650 0.180 292)'),
  },
  {
    name: 'Rose',
    swatchColors: ['#e11d48', '#f43f5e', '#fda4af'],
    tokens: makeTokens('oklch(0.560 0.240 15)', 'oklch(0.650 0.150 15)'),
  },
  {
    name: 'Orange',
    swatchColors: ['#ea580c', '#f97316', '#fdba74'],
    tokens: makeTokens('oklch(0.646 0.222 41)', 'oklch(0.720 0.140 41)'),
  },
  {
    name: 'Green',
    swatchColors: ['#16a34a', '#22c55e', '#86efac'],
    tokens: makeTokens('oklch(0.527 0.154 152)', 'oklch(0.650 0.100 152)'),
  },
]

// ─── Curated color palette ────────────────────────────────────────────────────
// Used in the token editor color picker. Each entry has a display hex and
// the OKLCH value that gets injected into the CSS variable.

export type CuratedColor = { label: string; hex: string; oklch: string }

export const CURATED_COLORS: CuratedColor[] = [
  // Whites / Neutrals
  { label: 'White',       hex: '#ffffff', oklch: 'oklch(1 0 0)' },
  { label: 'Near White',  hex: '#fafafa', oklch: 'oklch(0.985 0 0)' },
  { label: 'Gray 100',    hex: '#f5f5f5', oklch: 'oklch(0.970 0 0)' },
  { label: 'Gray 200',    hex: '#e5e5e5', oklch: 'oklch(0.922 0 0)' },
  { label: 'Gray 300',    hex: '#d4d4d4', oklch: 'oklch(0.872 0 0)' },
  { label: 'Gray 400',    hex: '#a3a3a3', oklch: 'oklch(0.708 0 0)' },
  { label: 'Gray 500',    hex: '#737373', oklch: 'oklch(0.556 0 0)' },
  { label: 'Gray 600',    hex: '#525252', oklch: 'oklch(0.455 0 0)' },
  { label: 'Gray 700',    hex: '#404040', oklch: 'oklch(0.371 0 0)' },
  { label: 'Gray 800',    hex: '#262626', oklch: 'oklch(0.269 0 0)' },
  { label: 'Gray 900',    hex: '#171717', oklch: 'oklch(0.205 0 0)' },
  { label: 'Near Black',  hex: '#0a0a0a', oklch: 'oklch(0.145 0 0)' },
  // Slates
  { label: 'Slate 400',   hex: '#94a3b8', oklch: 'oklch(0.704 0.040 256)' },
  { label: 'Slate 600',   hex: '#475569', oklch: 'oklch(0.446 0.043 257)' },
  { label: 'Slate 800',   hex: '#1e293b', oklch: 'oklch(0.298 0.036 264)' },
  // Blues
  { label: 'Blue 300',    hex: '#93c5fd', oklch: 'oklch(0.809 0.105 252)' },
  { label: 'Blue 500',    hex: '#3b82f6', oklch: 'oklch(0.623 0.214 260)' },
  { label: 'Blue 600',    hex: '#2563eb', oklch: 'oklch(0.546 0.245 264)' },
  { label: 'Blue 800',    hex: '#1e40af', oklch: 'oklch(0.424 0.199 266)' },
  // Indigo
  { label: 'Indigo 500',  hex: '#6366f1', oklch: 'oklch(0.585 0.233 277)' },
  { label: 'Indigo 700',  hex: '#4338ca', oklch: 'oklch(0.457 0.240 277)' },
  // Violet
  { label: 'Violet 400',  hex: '#a78bfa', oklch: 'oklch(0.702 0.183 294)' },
  { label: 'Violet 600',  hex: '#7c3aed', oklch: 'oklch(0.491 0.270 292)' },
  { label: 'Violet 800',  hex: '#5b21b6', oklch: 'oklch(0.380 0.216 293)' },
  // Purple
  { label: 'Purple 500',  hex: '#a855f7', oklch: 'oklch(0.627 0.265 304)' },
  { label: 'Purple 700',  hex: '#7e22ce', oklch: 'oklch(0.421 0.241 303)' },
  // Pink
  { label: 'Pink 400',    hex: '#f472b6', oklch: 'oklch(0.718 0.202 350)' },
  { label: 'Pink 600',    hex: '#db2777', oklch: 'oklch(0.556 0.245 350)' },
  // Rose
  { label: 'Rose 400',    hex: '#fb7185', oklch: 'oklch(0.712 0.194 20)' },
  { label: 'Rose 600',    hex: '#e11d48', oklch: 'oklch(0.560 0.240 15)' },
  // Red
  { label: 'Red 500',     hex: '#ef4444', oklch: 'oklch(0.637 0.237 25)' },
  { label: 'Red 700',     hex: '#b91c1c', oklch: 'oklch(0.505 0.213 28)' },
  // Orange
  { label: 'Orange 400',  hex: '#fb923c', oklch: 'oklch(0.750 0.183 56)' },
  { label: 'Orange 600',  hex: '#ea580c', oklch: 'oklch(0.646 0.222 41)' },
  // Amber
  { label: 'Amber 400',   hex: '#fbbf24', oklch: 'oklch(0.828 0.189 84)' },
  { label: 'Amber 600',   hex: '#d97706', oklch: 'oklch(0.666 0.179 58)' },
  // Green
  { label: 'Green 400',   hex: '#4ade80', oklch: 'oklch(0.792 0.209 152)' },
  { label: 'Green 600',   hex: '#16a34a', oklch: 'oklch(0.527 0.154 152)' },
  { label: 'Green 800',   hex: '#166534', oklch: 'oklch(0.393 0.095 153)' },
  // Teal
  { label: 'Teal 500',    hex: '#14b8a6', oklch: 'oklch(0.696 0.143 187)' },
  { label: 'Teal 700',    hex: '#0f766e', oklch: 'oklch(0.511 0.096 186)' },
  // Cyan
  { label: 'Cyan 500',    hex: '#06b6d4', oklch: 'oklch(0.715 0.143 215)' },
]
