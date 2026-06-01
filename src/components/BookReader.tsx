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

  if (pendingHeading) currentHtml += pendingHeading
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
  const pageRefs = useRef({ pages: [] as string[], current: 0, flipping: false })
  const parsedRef = useRef(false)

  useEffect(() => {
    if (contentRef.current && contentRef.current.children.length > 0) {
      const result = splitPages(contentRef.current, 1000)
      pageRefs.current.pages = result
      setPages(result)
      parsedRef.current = true
    }
  }, [])

  const total = pages.length
  const isFirst = current === 0
  const isLast = current === total - 1 || total === 0

  pageRefs.current.current = current
  pageRefs.current.flipping = !!flipping

  const flip = useCallback((dir: 'forward' | 'backward') => {
    const { current: c, flipping: f, pages: p } = pageRefs.current
    if (f) return
    if (dir === 'forward' && c >= p.length - 1) return
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

  const renderPage = (pageIndex: number, isFlipTarget: boolean) => (
    <div
      key={pageIndex}
      className={cardClass(isFlipTarget)}
      dangerouslySetInnerHTML={{ __html: pages[pageIndex] }}
    />
  )

  return (
    <div className="book-reader">
      {!parsedRef.current && (
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
      )}

      {!total ? (
        <div className="flex items-center justify-center flex-1 text-gray-400">Loading...</div>
      ) : (
        <>
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
              {flipping && flipping === 'forward'
                ? [renderPage(current, true), renderPage(current + 1, false)]
                : flipping && flipping === 'backward'
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
              onClick={() => flip('forward')}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
