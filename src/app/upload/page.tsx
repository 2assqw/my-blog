'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const WORKER_BASE = 'https://dl.2assqw.cc'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function UploadPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storage, setStorage] = useState<{ usedBytes: number; limitBytes: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_BASE}/api/storage`)
      const data = await res.json()
      setStorage(data)
    } catch {}
  }, [])

  const handleAuth = () => {
    if (password.length > 0) {
      setAuthed(true)
      fetchStorage()
    }
  }

  const doUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    setResult(null)
    setProgress(0)

    try {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }

      await new Promise<void>((resolve, reject) => {
        xhr.open('POST', `${WORKER_BASE}/api/upload?key=downloads/uploads/${encodeURIComponent(file.name)}`)
        xhr.setRequestHeader('X-Upload-Password', password)
        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText)
            setResult(data.r2Key)
            resolve()
          } else if (xhr.status === 401) {
            reject(new Error('密码错误'))
          } else if (xhr.status === 413) {
            reject(new Error('文件超过 100MB 限制'))
          } else if (xhr.status === 507) {
            reject(new Error('存储空间不足（已用超过 10GB）'))
          } else {
            reject(new Error(`上传失败 (${xhr.status})`))
          }
        }
        xhr.onerror = () => reject(new Error('网络错误'))
        xhr.send(file)
      })

      fetchStorage()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) doUpload(file)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) doUpload(file)
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-6 py-32">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">上传资源</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          placeholder="输入上传密码"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
          autoFocus
        />
        <button
          onClick={handleAuth}
          disabled={!password}
          className="w-full mt-3 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-30"
        >
          确认
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">上传资源</h1>
      {storage && (
        <p className="text-center text-sm text-gray-400 mb-8">
          已用 {formatSize(storage.usedBytes)} / 10 GB
        </p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInput.current?.click()}
        className={`
          rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors
          ${dragging ? 'border-brand bg-brand-50 dark:bg-brand-50/10' : 'border-gray-200 hover:border-gray-300'}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-gray-500 mb-1">拖拽文件到这里或点击选择</p>
        <p className="text-xs text-gray-400">单文件最大 100MB</p>
        <input ref={fileInput} type="file" onChange={handleFile} className="hidden" />
      </div>

      {uploading && (
        <div className="mt-6">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-sm text-gray-400 mt-2">上传中 {progress}%</p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm text-center">{error}</div>
      )}

      {result && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm break-all">
          上传成功！<br />
          <code className="font-mono text-xs mt-1 block select-all">{result}</code>
        </div>
      )}
    </div>
  )
}
