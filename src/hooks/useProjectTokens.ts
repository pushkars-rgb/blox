import { useEffect } from 'react'

function hexToOklch(hex: string): string {
  // Convert hex → linear RGB → XYZ → OKLab → OKLCH
  const clean = hex.replace('#', '')
  let r = parseInt(clean.slice(0, 2), 16) / 255
  let g = parseInt(clean.slice(2, 4), 16) / 255
  let b = parseInt(clean.slice(4, 6), 16) / 255

  // Linearise
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

  // Linear RGB → XYZ (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

  // XYZ → OKLab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z)

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

  // OKLab → OKLCH
  const C = Math.sqrt(a * a + bVal * bVal)
  const h = Math.atan2(bVal, a) * 180 / Math.PI
  const hue = h < 0 ? h + 360 : h

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${hue.toFixed(3)})`
}

export function injectTokens(primaryHex: string, colors: string[]) {
  const root = document.documentElement
  const oklch = hexToOklch(primaryHex)
  root.style.setProperty('--primary', oklch)
  root.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)')
  colors.forEach((color, i) => {
    root.style.setProperty(`--palette-${i}-hex`, color)
  })
}

export function clearTokens(colorCount: number) {
  const root = document.documentElement
  root.style.removeProperty('--primary')
  root.style.removeProperty('--primary-foreground')
  for (let i = 0; i < colorCount; i++) {
    root.style.removeProperty(`--palette-${i}-hex`)
  }
}

export function useProjectTokens(primaryColor: string, paletteColors: string[]) {
  useEffect(() => {
    injectTokens(primaryColor, paletteColors)
    return () => clearTokens(paletteColors.length)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
