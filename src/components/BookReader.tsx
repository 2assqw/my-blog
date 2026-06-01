'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Link from 'next/link'

interface BookReaderProps {
  title: string
  date: string
  backHref: string
  backLabel: string
  children: ReactNode
}

// ---- pagination: walk DOM, break at paragraph boundaries ----

function splitPages(container: HTMLElement, targetChars: number): string[] {
  const pages: string[] = []
  let currentHtml = ''
  let currentChars = 0
  let pendingHeading = ''
  let pendingChars = 0

  for (const child of Array.from(container.children)) {
    const el = child as HTMLElement
    const text = el.textContent || ''
    const html = el.outerHTML
    const isHeading = /^H[2-4]$/.test(el.tagName)

    if (isHeading) {
      if (currentChars > 0) {
        pages.push(currentHtml)
        currentHtml = ''
        currentChars = 0
      }
      pendingHeading = html
      pendingChars = text.length
      continue
    }

    const blockHtml = pendingHeading ? pendingHeading + html : html
    const blockChars = pendingChars + text.length
    pendingHeading = ''
    pendingChars = 0

    if (currentChars > 0 && currentChars + blockChars > targetChars + 200) {
      pages.push(currentHtml)
      currentHtml = blockHtml
      currentChars = blockChars
    } else {
      currentHtml += blockHtml
      currentChars += blockChars
    }
  }

  if (pendingHeading) {
    currentHtml += pendingHeading
  }
  if (currentHtml) pages.push(currentHtml)
  return pages.length > 0 ? pages : ['']
}

export function BookReader({ title, date, backHref, backLabel, children }: BookReaderProps) {
  const [pages, setPages] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [flipping, setFlipping] = useState<'forward' | 'backward' | null>(null)
  const [showInput, setShowInput] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const parsedRef = useRef(false)

  // Walk rendered DOM and split into pages (runs once — SSG content is static)
  useEffect(() => {
    if (!parsedRef.current && contentRef.current && contentRef.current.children.length > 0) {
      const result = splitPages(contentRef.current, 1000)
      setPages(result)
      parsedRef.current = true
    }
  })

  const total = pages.length
  const isFirst = current === 0
  const isLast = current === total - 1 || total === 0

  const flip = useCallback(
    (dir: 'forward' | 'backward') => {
      if (flipping) return
      if (dir === 'forward' && isLast) return
      if (dir === 'backward' && isFirst) return
      setFlipping(dir)
      setTimeout(() => {
        setFlipping(null)
        setCurrent((p) => (dir === 'forward' ? p + 1 : p - 1))
      }, 400)
    },
    [flipping, isFirst, isLast],
  )

  const goNext = useCallback(() => flip('forward'), [flip])
  const goPrev = useCallback(() => flip('backward'), [flip])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // Focus input when toggled
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [showInput])

  const handlePageJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(e.currentTarget.value, 10)
      if (num >= 1 && num <= total) {
        setCurrent(num - 1)
      }
      setShowInput(false)
    }
  }

  // ---- flip class helpers ----

  const cardClass = (isFlipTarget: boolean) => {
    if (!flipping) return 'book-card'
    if (!isFlipTarget) return 'book-card book-card-hidden'
    return `book-card ${flipping === 'forward' ? 'flip-forward' : 'flip-backward'}`
  }

  const renderPage = (pageIndex: number, isFlipTarget: boolean) => (
    <div
      key={pageIndex}
      className={cardClass(isFlipTarget)}
      dangerouslySetInnerHTML={{ __html: pages[pageIndex] }}
    />
  )

  if (!total) {
    return <div className="text-gray-400 text-center py-20">Loading...</div>
  }

  return (
    <div className="book-reader">
      {/* ---- hidden DOM for parsing ---- */}
      <div
        ref={contentRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          width: '75%',
          maxWidth: 700,
        }}
      >
        {children}
      </div>

      {/* ---- top bar ---- */}
      <div className="book-topbar">
        <Link href={backHref} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← {backLabel}
        </Link>
        <span className="text-xs font-semibold text-gray-800 truncate max-w-[50%]">{title}</span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>

      {/* ---- page stage ---- */}
      <div className="book-stage">
        {/* Left hot zone */}
        <div
          className={`book-hotzone book-hotzone-left ${isFirst ? 'pointer-events-none' : ''}`}
          onClick={goPrev}
        >
          <div className={`book-arrow ${isFirst ? 'opacity-0' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        {/* Page card */}
        <div className="book-viewport">
          {flipping && flipping === 'forward'
            ? [renderPage(current, true), renderPage(current + 1, false)]
            : flipping && flipping === 'backward'
              ? [renderPage(current, true), renderPage(current - 1, false)]
              : renderPage(current, false)}
        </div>

        {/* Right hot zone */}
        <div
          className={`book-hotzone book-hotzone-right ${isLast ? 'pointer-events-none' : ''}`}
          onClick={goNext}
        >
          <div className={`book-arrow ${isLast ? 'opacity-0' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* ---- bottom bar ---- */}
      <div className="book-bottombar">
        <button
          className={`text-gray-400 hover:text-gray-700 transition-colors ${isFirst ? 'invisible' : ''}`}
          onClick={goPrev}
        >
          ←
        </button>

        {showInput ? (
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
        )}

        <button
          className={`text-gray-700 hover:text-gray-900 transition-colors ${isLast ? 'invisible' : ''}`}
          onClick={goNext}
        >
          →
        </button>
      </div>
    </div>
  )
}
