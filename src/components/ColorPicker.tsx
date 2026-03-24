import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ─── Color math ───────────────────────────────────────────────────────────────

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '').slice(0, 6)
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToHex(h: number, s: number, v: number): string {
  const i = Math.floor(h / 60) % 6
  const f = h / 60 - Math.floor(h / 60)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const combos = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]]
  const [r, g, b] = combos[i]
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hueToHex(h: number): string {
  return hsvToHex(h, 1, 1)
}

function isValidHex(h: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(h)
}

function parseInitialHex(value: string): string {
  if (value.startsWith('linear-gradient')) return '#000000'
  return isValidHex(value) ? value : '#000000'
}

// ─── Draggable slider hook ────────────────────────────────────────────────────

function useDrag(onMove: (ratio: number) => void) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const move = (ev: MouseEvent) => {
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      onMove(ratio)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    move(e.nativeEvent)
  }, [onMove])

  return { ref, handleMouseDown }
}

// ─── Spectrum canvas ──────────────────────────────────────────────────────────

function Spectrum({
  hue,
  sat,
  val,
  onChange,
}: {
  hue: number
  sat: number
  val: number
  onChange: (s: number, v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const move = (ev: MouseEvent) => {
      const s = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const v = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height))
      onChange(s, v)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    move(e.nativeEvent)
  }, [onChange])

  const hueHex = hueToHex(hue)

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      className="relative w-full h-36 rounded-md cursor-crosshair select-none overflow-hidden"
      style={{ background: hueHex }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, transparent, #000)' }}
      />
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: `${sat * 100}%`,
          top: `${(1 - val) * 100}%`,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  )
}

// ─── ColorPicker ─────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string
  onChange: (v: string) => void
  paletteColors: string[]
  noGradient?: boolean
  /** Shown in the trigger swatch when value is empty — does not affect picker state */
  placeholderColor?: string
}

export default function ColorPicker({ value, onChange, paletteColors, noGradient = false, placeholderColor }: ColorPickerProps) {
  const isGradient = value.startsWith('linear-gradient')
  const [mode, setMode] = useState<'solid' | 'gradient'>(isGradient ? 'gradient' : 'solid')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const initHex = parseInitialHex(value)
  const initHsv = hexToHsv(initHex)

  const [hue, setHue] = useState(initHsv.h)
  const [sat, setSat] = useState(initHsv.s)
  const [val, setVal] = useState(initHsv.v)
  const [opacity, setOpacity] = useState(100)
  const [hexInput, setHexInput] = useState(initHex.slice(1).toUpperCase())

  const [gradientAngle, setGradientAngle] = useState(90)
  const [gradientFrom, setGradientFrom] = useState(paletteColors[0] ?? '#000000')
  const [gradientTo, setGradientTo] = useState(paletteColors[1] ?? '#ffffff')

  // Sync when value changes externally
  useEffect(() => {
    if (!open) {
      if (!value.startsWith('linear-gradient') && isValidHex(value)) {
        const hsv = hexToHsv(value)
        setHue(hsv.h)
        setSat(hsv.s)
        setVal(hsv.v)
        setHexInput(value.slice(1).toUpperCase())
      }
    }
  }, [value, open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentHex = hsvToHex(hue, sat, val)
  const currentGradient = `linear-gradient(${gradientAngle}deg, ${gradientFrom}, ${gradientTo})`
  const displayValue = mode === 'gradient' ? currentGradient : currentHex

  function openPanel() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const panelW = 256
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
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function emitSolid(h: number, s: number, v: number) {
    const hex = hsvToHex(h, s, v)
    onChange(hex)
    setHexInput(hex.slice(1).toUpperCase())
  }

  function emitGradient(from = gradientFrom, to = gradientTo, angle = gradientAngle) {
    onChange(`linear-gradient(${angle}deg, ${from}, ${to})`)
  }

  const hueTrack = useDrag((ratio) => {
    const h = ratio * 360
    setHue(h)
    if (mode === 'solid') emitSolid(h, sat, val)
  })

  const opacityTrack = useDrag((ratio) => {
    setOpacity(Math.round(ratio * 100))
  })

  function handleSpectrumChange(s: number, v: number) {
    setSat(s)
    setVal(v)
    emitSolid(hue, s, v)
  }

  function handleHexInput(raw: string) {
    setHexInput(raw.toUpperCase())
    const hex = `#${raw}`
    if (isValidHex(hex)) {
      const hsv = hexToHsv(hex)
      setHue(hsv.h)
      setSat(hsv.s)
      setVal(hsv.v)
      onChange(hex)
    }
  }

  function handleHexBlur() {
    const hex = `#${hexInput}`
    if (!isValidHex(hex)) {
      setHexInput(currentHex.slice(1).toUpperCase())
    }
  }

  function handlePalettePick(color: string) {
    setMode('solid')
    const hsv = hexToHsv(color)
    setHue(hsv.h)
    setSat(hsv.s)
    setVal(hsv.v)
    setHexInput(color.slice(1).toUpperCase())
    onChange(color)
  }

  const hueHandleLeft = `${(hue / 360) * 100}%`
  const opacityHandleLeft = `${opacity}%`

  const triggerColor = !value && placeholderColor ? placeholderColor : displayValue

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        className="w-7 h-7 rounded-md border border-border cursor-pointer shrink-0"
        style={{ background: triggerColor, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
      />

      {open && (
        <div
          ref={panelRef}
          style={{ left: pos.x, top: pos.y, width: 256 }}
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

          <div className="p-3 flex flex-col gap-3">
            {/* Mode tabs */}
            {!noGradient && (
              <div className="flex gap-1.5">
                {(['solid', 'gradient'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m)
                      if (m === 'gradient') emitGradient()
                      else onChange(currentHex)
                    }}
                    className={cn(
                      'text-xs px-3 py-1 rounded-md cursor-pointer capitalize',
                      mode === m ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Solid mode */}
            {mode === 'solid' && (
              <>
                <Spectrum hue={hue} sat={sat} val={val} onChange={handleSpectrumChange} />

                {/* Hue slider */}
                <div className="relative h-3" {...hueTrack}>
                  <div
                    ref={hueTrack.ref}
                    onMouseDown={hueTrack.handleMouseDown}
                    className="w-full h-3 rounded-full cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                  >
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-4 rounded-sm border-2 border-white shadow pointer-events-none"
                      style={{ left: hueHandleLeft, background: hueToHex(hue) }}
                    />
                  </div>
                </div>

                {/* Opacity slider */}
                <div className="relative h-3">
                  <div
                    ref={opacityTrack.ref}
                    onMouseDown={opacityTrack.handleMouseDown}
                    className="w-full h-3 rounded-full cursor-pointer relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                        backgroundSize: '6px 6px',
                        backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ background: `linear-gradient(to right, transparent, ${currentHex})` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-4 rounded-sm border-2 border-white shadow pointer-events-none"
                      style={{ left: opacityHandleLeft }}
                    />
                  </div>
                </div>

                {/* Hex + opacity inputs */}
                <div className="flex gap-2 items-center">
                  <div className="flex items-center flex-1 bg-muted border border-border rounded-md overflow-hidden h-7">
                    <span className="text-xs text-muted-foreground pl-2">#</span>
                    <input
                      value={hexInput}
                      onChange={(e) => handleHexInput(e.target.value)}
                      onBlur={handleHexBlur}
                      maxLength={6}
                      className="flex-1 text-xs font-mono bg-transparent px-1 outline-none min-w-0"
                    />
                  </div>
                  <div className="flex items-center bg-muted border border-border rounded-md overflow-hidden h-7 w-14">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={opacity}
                      onChange={(e) => setOpacity(Math.max(0, Math.min(100, Number(e.target.value))))}
                      className="flex-1 text-xs font-mono bg-transparent px-2 outline-none min-w-0 text-right"
                    />
                    <span className="text-xs text-muted-foreground pr-1.5">%</span>
                  </div>
                </div>
              </>
            )}

            {/* Gradient mode */}
            {mode === 'gradient' && (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8 shrink-0">From</span>
                    <ColorPicker
                      value={gradientFrom}
                      onChange={(v) => { setGradientFrom(v); emitGradient(v, gradientTo, gradientAngle) }}
                      paletteColors={paletteColors}
                      noGradient
                    />
                    <span className="text-xs font-mono text-muted-foreground">{gradientFrom}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8 shrink-0">To</span>
                    <ColorPicker
                      value={gradientTo}
                      onChange={(v) => { setGradientTo(v); emitGradient(gradientFrom, v, gradientAngle) }}
                      paletteColors={paletteColors}
                      noGradient
                    />
                    <span className="text-xs font-mono text-muted-foreground">{gradientTo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-8 shrink-0">Angle</span>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={gradientAngle}
                      onChange={(e) => {
                        const a = Number(e.target.value)
                        setGradientAngle(a)
                        emitGradient(gradientFrom, gradientTo, a)
                      }}
                      className="w-16 h-7 text-xs font-mono bg-muted border border-border rounded-md px-2 outline-none"
                    />
                    <span className="text-xs text-muted-foreground">°</span>
                  </div>
                </div>
                <div
                  className="w-full h-6 rounded-md border border-border"
                  style={{ background: currentGradient }}
                />
              </>
            )}

            {/* Palette swatches */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Project palette</p>
              <div className="flex gap-1.5 flex-wrap">
                {paletteColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handlePalettePick(color)}
                    className={cn(
                      'w-5 h-5 rounded-sm cursor-pointer transition-all',
                      value === color && 'ring-2 ring-offset-1 ring-foreground',
                    )}
                    style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
