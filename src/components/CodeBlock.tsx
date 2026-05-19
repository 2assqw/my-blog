'use client'

import { useState } from 'react'

interface CodeBlockProps {
  filename?: string
  children: React.ReactNode
}

export function CodeBlock({ filename, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (typeof children === 'string') {
      await navigator.clipboard.writeText(children)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-6 rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-100 px-4 py-2 text-xs text-gray-500">
        {filename ? (
          <span className="font-mono">{filename}</span>
        ) : (
          <span />
        )}
        <button
          onClick={handleCopy}
          className="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-gray-50 p-4 text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  )
}
