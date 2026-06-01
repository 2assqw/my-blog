'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Link from 'next/link'

interface BookReaderProps {
  title: string
  date: string
  backHref: string
  backLabel: string
  pages: ReactNode[]
}

export function BookReader({ title, date, backHref, backLabel, pages }: BookReaderProps) {
  const [current, setCurrent] = useState(0)
  const [flipping, setFlipping] = useState<'forward' | 'backward' | null>(null)
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const refs = useRef({ current: 0, flipping: false, total: pages.length })

  refs.current.current = current
  refs.current.flipping = !!flipping
  refs.current.total = pages.length

  const total = pages.length
  const isFirst = current === 0
  const isLast = current === total - 1 || total === 0

  const flip = useCallback((dir: 'forward' | 'backward') => {
    const { current: c, flipping: f, total: t } = refs.current
    if (f) return
    if (dir === 'forward' && c >= t - 1) return
    if (dir === 'backward' && c === 0) return
    setFlipping(dir)
    setTimeout(() => {
      setFlipping(null)
      setCurrent((prev) => (dir === 'forward' ? prev + 1 : prev - 1))
    }, 400)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') flip('forward')
      else if (e.key === 'ArrowLeft') flip('backward')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip])

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [showInput])

  const handlePageJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(e.currentTarget.value, 10)
      if (num >= 1 && num <= total) setCurrent(num - 1)
      setShowInput(false)
    }
  }

  const cardClass = (isFlipTarget: boolean) => {
    if (!flipping) return 'book-card'
    if (!isFlipTarget) return 'book-card book-card-hidden'
    return `book-card ${flipping === 'forward' ? 'flip-forward' : 'flip-backward'}`
  }

  const renderPage = (idx: number, isTarget: boolean) => (
    <div key={idx} className={cardClass(isTarget)}>
      {pages[idx]}
    </div>
  )

  if (!total) {
    return <div className="text-gray-400 text-center py-20">No content</div>
  }

  return (
    <div className="book-reader">
      <div className="book-topbar">
        <Link href={backHref} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← {backLabel}
        </Link>
        <span className="text-xs font-semibold text-gray-800 truncate max-w-[50%]">{title}</span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>

      <div className="book-stage">
        <div
          className={`book-hotzone book-hotzone-left ${isFirst ? 'pointer-events-none' : ''}`}
          onClick={() => flip('backward')}
        >
          <div className={`book-arrow ${isFirst ? 'opacity-0' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        <div className="book-viewport">
          {flipping === 'forward'
            ? [renderPage(current, true), renderPage(current + 1, false)]
            : flipping === 'backward'
              ? [renderPage(current, true), renderPage(current - 1, false)]
              : renderPage(current, false)}
        </div>

        <div
          className={`book-hotzone book-hotzone-right ${isLast ? 'pointer-events-none' : ''}`}
          onClick={() => flip('forward')}
        >
          <div className={`book-arrow ${isLast ? 'opacity-0' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="book-bottombar">
        <button
          className={`text-gray-400 hover:text-gray-700 transition-colors ${isFirst ? 'invisible' : ''}`}
          onClick={() => flip('backward')}
        >
          ←
        </button>

        {total > 1 &&
          (showInput ? (
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={total}
              className="book-page-input"
              defaultValue={current + 1}
              onKeyDown={handlePageJump}
              onBlur={() => setShowInput(false)}
            />
          ) : (
            <button
              className="book-page-indicator"
              onClick={() => setShowInput(true)}
              title="点击输入页码跳转"
            >
              {current + 1} / {total}
            </button>
          ))}

        <button
          className={`text-gray-700 hover:text-gray-900 transition-colors ${isLast ? 'invisible' : ''}`}
          onClick={() => flip('forward')}
        >
          →
        </button>
      </div>
    </div>
  )
}
