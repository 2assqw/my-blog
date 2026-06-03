'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [transition, setTransition] = useState<{ x: number; y: number } | null>(null)

  // Auto-detect from time: dark before 7am and after 7pm
  useEffect(() => {
    const saved = localStorage.getItem('finscope-theme') as Theme | null
    if (saved) { setTheme(saved); return }

    const h = new Date().getHours()
    setTheme(h >= 7 && h < 19 ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('finscope-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    // Capture click position for reveal animation
    if (typeof window !== 'undefined') {
      setTransition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    }
    setTheme(t => t === 'light' ? 'dark' : 'light')
    setTimeout(() => setTransition(null), 800)
  }, [])

  return (
    <Ctx.Provider value={{ theme, toggle }}>
      {transition && (
        <div
          className="theme-reveal"
          style={{
            left: transition.x,
            top: transition.y,
          }}
        />
      )}
      {children}
    </Ctx.Provider>
  )
}
