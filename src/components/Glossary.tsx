'use client'

import { useState, useRef, useEffect } from 'react'

interface GlossaryProps {
  children: React.ReactNode
  tip: string
}

export function Glossary({ children, tip }: GlossaryProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')
  const timer = useRef(0)
  const ref = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const show = () => {
    timer.current = window.setTimeout(() => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setPosition(rect.top < 120 ? 'bottom' : 'top')
      }
      setVisible(true)
    }, 1500)
  }

  const hide = () => {
    clearTimeout(timer.current)
    setVisible(false)
  }

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  return (
    <span ref={ref} className="relative inline" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <span className="cursor-help border-b border-dashed border-gray-400 dark:border-gray-500 text-inherit">
        {children}
      </span>
      {visible && (
        <div
          ref={popupRef}
          className={`
            absolute left-1/2 -translate-x-1/2 z-50
            px-3 py-2 rounded-lg shadow-lg
            bg-white dark:bg-gray-800
            border border-gray-100 dark:border-gray-700
            text-sm text-gray-700 dark:text-gray-300
            whitespace-nowrap
            pointer-events-none
            animate-[fadeIn_0.15s_ease-out]
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
          `}
        >
          {tip}
          <div
            className={`
              absolute left-1/2 -translate-x-1/2
              w-2 h-2 rotate-45
              bg-white dark:bg-gray-800
              border border-gray-100 dark:border-gray-700
              ${position === 'top' ? 'top-full -mt-1 border-t-0 border-l-0' : 'bottom-full -mb-1 border-b-0 border-r-0'}
            `}
          />
        </div>
      )}
    </span>
  )
}
