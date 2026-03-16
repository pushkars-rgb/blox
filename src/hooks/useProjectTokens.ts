import { useEffect } from 'react'
import { hexToOklch, injectSemanticTokens, clearSemanticTokens, type SemanticTokens } from '@/lib/tokens'

// Inject palette hex vars used by ColorPicker swatches
function injectPaletteVars(colors: string[]) {
  const root = document.documentElement
  colors.forEach((color, i) => {
    root.style.setProperty(`--palette-${i}-hex`, color)
  })
}

function clearPaletteVars(colorCount: number) {
  const root = document.documentElement
  for (let i = 0; i < colorCount; i++) {
    root.style.removeProperty(`--palette-${i}-hex`)
  }
}

// Legacy helper — injects only primary + palette vars (kept for backward compat)
export function injectTokens(primaryHex: string, colors: string[]) {
  const root = document.documentElement
  root.style.setProperty('--primary', hexToOklch(primaryHex))
  root.style.setProperty('--primary-foreground', 'oklch(0.985 0 0)')
  injectPaletteVars(colors)
}

// Full semantic token injection + palette vars for the active project
export function useProjectTokens(
  tokens: SemanticTokens,
  paletteColors: string[],
) {
  useEffect(() => {
    injectSemanticTokens(tokens)
    injectPaletteVars(paletteColors)
    return () => {
      clearSemanticTokens()
      clearPaletteVars(paletteColors.length)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export { hexToOklch }
