'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const KEY = 'portfolio-theme' // shared with the portfolio site

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
})

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  html.classList.toggle('light', theme === 'light')
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    // The inline <head> script already painted the right theme; sync React state to it.
    let current = document.documentElement.getAttribute('data-theme') as Theme | null
    if (current !== 'light' && current !== 'dark') {
      current = stored() ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      applyTheme(current)
    }
    setTheme(current)

    const mq = matchMedia('(prefers-color-scheme: light)')
    const onChange = (e: MediaQueryListEvent) => {
      if (stored()) return // an explicit choice wins
      const next: Theme = e.matches ? 'light' : 'dark'
      applyTheme(next)
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try { localStorage.setItem(KEY, next) } catch { /* storage unavailable */ }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
