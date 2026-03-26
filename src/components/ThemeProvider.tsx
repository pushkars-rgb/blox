import { useEffect, useState } from 'react'
import { ThemeContext } from '@/hooks/useTheme'
import { DARK_CSS_VARS } from '@/lib/tokens'

function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem('blox_theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function applyDarkStyle(isDark: boolean) {
  let el = document.getElementById('blox-dark-tokens') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'blox-dark-tokens'
    document.head.appendChild(el)
  }
  if (isDark) {
    // :root.dark {} has specificity 0-2-0, beats :root {} project tokens (0-1-0)
    const lines = Object.entries(DARK_CSS_VARS).map(([k, v]) => `  ${k}: ${v};`)
    el.textContent = `:root.dark {\n${lines.join('\n')}\n}`
  } else {
    el.textContent = ''
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(getInitialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('blox_theme', isDark ? 'dark' : 'light')
    applyDarkStyle(isDark)
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  )
}
