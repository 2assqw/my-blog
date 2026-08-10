# Downloads Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resource-download section with card-grid list + detail pages with file tables. Files stored on Cloudflare R2, download counting via Worker + D1.

**Architecture:** New `content/downloads/*.mdx` data source, parsed at build time with R2 metadata merged from a pre-build script. Two new pages (`/downloads` list, `/downloads/[slug]` detail) render statically. Download buttons point to `dl.2assqw.cc` Worker which records to D1 then 307-redirects to R2 presigned URLs.

**Tech Stack:** Next.js 15 SSG, TypeScript, Tailwind CSS, MDX (next-mdx-remote), Cloudflare Workers, R2, D1

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `DownloadFile`, `DownloadPostFrontmatter`, `DownloadPost` interfaces |
| Create | `src/lib/downloads.ts` | `getDownloadPosts()`, `getDownloadPost()` — parse MDX + merge R2 sizes |
| Create | `scripts/fetch-r2-meta.ts` | Pre-build: query R2, write `content/r2-meta.json` |
| Modify | `package.json` | Update `build` script to run fetch-r2-meta first |
| Create | `src/components/DownloadCard.tsx` | Card for list page (cover, title, tags, file count + size) |
| Create | `src/components/FileDownloadTable.tsx` | Client component: file table with download buttons + live count |
| Create | `src/app/downloads/page.tsx` | List page (card grid) |
| Create | `src/app/downloads/[slug]/page.tsx` | Detail page (MDX body + file table) |
| Modify | `src/components/Header.tsx` | Add Downloads nav link |
| Create | `content/downloads/example.mdx` | Sample resource for dev testing |
| Create | `cloudflare-worker/package.json` | Worker dependencies |
| Create | `cloudflare-worker/tsconfig.json` | Worker TS config |
| Create | `cloudflare-worker/wrangler.toml` | R2 + D1 bindings, route `dl.2assqw.cc/*` |
| Create | `cloudflare-worker/src/index.ts` | Worker: `/dl/:slug/:fp` and `/api/downloads/:slug/count` |

---

## Phase 1: Data Layer

### Task 1: Add type definitions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add download interfaces**

Add to `src/lib/types.ts` after the `Project` interface:

```ts
export interface DownloadFile {
  name: string
  r2Key: string
  size?: number
}

export interface DownloadPostFrontmatter {
  title: string
  date: string
  tags: string[]
  summary: string
  cover?: string
  draft?: boolean
}

export interface DownloadPost {
  slug: string
  frontmatter: DownloadPostFrontmatter
  files: DownloadFile[]
  content: string
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add download type definitions"
```

---

### Task 2: Create downloads data layer

**Files:**
- Create: `src/lib/downloads.ts`

- [ ] **Step 1: Create `src/lib/downloads.ts`**

```ts
import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import type { DownloadPost, DownloadPostFrontmatter } from './types'

const DOWNLOADS_DIR = path.join(process.cwd(), 'content', 'downloads')
const R2_META_PATH = path.join(process.cwd(), 'content', 'r2-meta.json')

async function loadR2Meta(): Promise<Record<string, { size: number; etag: string }>> {
  try {
    const raw = await fs.readFile(R2_META_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function getDownloadPosts(): Promise<DownloadPost[]> {
  const r2Meta = await loadR2Meta()

  try {
    const files = await fs.readdir(DOWNLOADS_DIR)
    const mdxFiles = files.filter((f) => /\.mdx?$/.test(f))

    const posts = await Promise.all(
      mdxFiles.map(async (filename) => {
        const filePath = path.join(DOWNLOADS_DIR, filename)
        const raw = await fs.readFile(filePath, 'utf-8')
        const { data, content } = matter(raw)
        const frontmatter = data as DownloadPostFrontmatter
        const slug = filename.replace(/\.mdx?$/, '')

        if (frontmatter.date) {
          frontmatter.date = new Date(frontmatter.date).toISOString().slice(0, 10)
        }

        const files = (data.files || []).map((f: { name: string; r2Key: string }) => ({
          name: f.name,
          r2Key: f.r2Key,
          size: r2Meta[f.r2Key]?.size,
        }))

        return { slug, frontmatter, files, content }
      })
    )

    return posts
      .filter((p) => !p.frontmatter.draft)
      .sort(
        (a, b) =>
          new Date(b.frontmatter.date).getTime() -
          new Date(a.frontmatter.date).getTime()
      )
  } catch {
    return []
  }
}

export async function getDownloadPost(slug: string): Promise<DownloadPost | null> {
  const r2Meta = await loadR2Meta()
  const filePath = path.join(DOWNLOADS_DIR, `${slug}.mdx`)

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const frontmatter = data as DownloadPostFrontmatter
    if (frontmatter.date) {
      frontmatter.date = new Date(frontmatter.date).toISOString().slice(0, 10)
    }

    const files = (data.files || []).map((f: { name: string; r2Key: string }) => ({
      name: f.name,
      r2Key: f.r2Key,
      size: r2Meta[f.r2Key]?.size,
    }))

    return { slug, frontmatter, files, content }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/downloads.ts
git commit -m "feat: add downloads data layer"
```

---

## Phase 2: Build Script

### Task 3: Create R2 metadata fetch script

**Files:**
- Create: `scripts/fetch-r2-meta.ts`

- [ ] **Step 1: Create `scripts/fetch-r2-meta.ts`**

```ts
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface R2Object {
  key: string
  size: number
  etag: string
}

async function main() {
  const outputPath = path.join(process.cwd(), 'content', 'r2-meta.json')

  try {
    const raw = execSync('npx wrangler r2 object list blog-downloads --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const objects: R2Object[] = JSON.parse(raw)
    const meta: Record<string, { size: number; etag: string }> = {}

    for (const obj of objects) {
      meta[obj.key] = { size: obj.size, etag: obj.etag }
    }

    fs.writeFileSync(outputPath, JSON.stringify(meta, null, 2))

    console.log(`[fetch-r2-meta] Wrote ${Object.keys(meta).length} entries to ${outputPath}`)
  } catch (err) {
    console.warn('[fetch-r2-meta] Failed to fetch R2 metadata (bucket may be empty or wrangler not configured):', (err as Error).message)
    // Write empty meta so build doesn't break
    fs.writeFileSync(outputPath, '{}')
  }
}

main()
```

- [ ] **Step 2: Verify script can run (expect warning — no wrangler configured yet)**

```bash
npx tsx scripts/fetch-r2-meta.ts
```

Expected: `[fetch-r2-meta] Failed to fetch R2 metadata...` and `content/r2-meta.json` created with `{}`.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-r2-meta.ts content/r2-meta.json
echo "content/r2-meta.json" >> .gitignore
git add .gitignore
git commit -m "feat: add R2 metadata fetch script"
```

---

### Task 4: Update build script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the `build` script in `package.json`**

Current:
```json
"build": "next build",
```

Change to:
```json
"build": "tsx scripts/fetch-r2-meta.ts && next build",
```

- [ ] **Step 2: Verify script appears in config**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts.build)"
```

Expected: `tsx scripts/fetch-r2-meta.ts && next build`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: run R2 meta fetch before build"
```

---

## Phase 3: UI Components & Pages

### Task 5: Create DownloadCard component

**Files:**
- Create: `src/components/DownloadCard.tsx`

- [ ] **Step 1: Create `src/components/DownloadCard.tsx`**

```tsx
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { DownloadPost } from '@/lib/types'

interface DownloadCardProps {
  post: DownloadPost
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function DownloadCard({ post }: DownloadCardProps) {
  const { frontmatter, slug, files } = post
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  const href = `/downloads/${slug}`

  return (
    <Link href={href} className="group block">
      <article className="rounded-xl border border-gray-100 bg-white overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-gray-200">
        {frontmatter.cover && (
          <div className="aspect-video bg-gray-100 overflow-hidden">
            <img
              src={frontmatter.cover}
              alt={frontmatter.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
            <time dateTime={frontmatter.date}>
              {format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
            </time>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand transition-colors mb-2">
            {frontmatter.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {frontmatter.summary}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {frontmatter.tags?.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-600">
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {files.length} file{files.length !== 1 ? 's' : ''}{totalSize > 0 ? ` · ${formatSize(totalSize)}` : ''}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DownloadCard.tsx
git commit -m "feat: add DownloadCard component"
```

---

### Task 6: Create FileDownloadTable component

**Files:**
- Create: `src/components/FileDownloadTable.tsx`

- [ ] **Step 1: Create `src/components/FileDownloadTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { DownloadFile } from '@/lib/types'

const WORKER_BASE = 'https://dl.2assqw.cc'

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function fingerprint(r2Key: string): string {
  const last = r2Key.split('/').pop() || r2Key
  return encodeURIComponent(last)
}

interface FileDownloadTableProps {
  slug: string
  files: DownloadFile[]
  initialCount: number
}

export function FileDownloadTable({ slug, files, initialCount }: FileDownloadTableProps) {
  const [count, setCount] = useState(initialCount)
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = (file: DownloadFile) => {
    setDownloading(file.name)
    setCount((c) => c + 1)
    setTimeout(() => setDownloading(null), 1000)
  }

  if (files.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">No files uploaded yet.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Files</h2>
        {count > 0 && (
          <span className="text-xs text-gray-400">{count} downloads</span>
        )}
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        {files.map((file, i) => (
          <a
            key={file.r2Key}
            href={`${WORKER_BASE}/dl/${slug}/${fingerprint(file.r2Key)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleDownload(file)}
            className={`
              flex items-center justify-between px-6 py-4
              ${i < files.length - 1 ? 'border-b border-gray-50' : ''}
              hover:bg-gray-50 transition-colors group
            `}
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
            </div>
            <span className={`
              shrink-0 ml-4 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${downloading === file.name
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
              }
            `}>
              {downloading === file.name ? 'Downloaded!' : 'Download'}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FileDownloadTable.tsx
git commit -m "feat: add FileDownloadTable component"
```

---

### Task 7: Create downloads list page

**Files:**
- Create: `src/app/downloads/page.tsx`

- [ ] **Step 1: Create `src/app/downloads/page.tsx`**

```tsx
import { getDownloadPosts } from '@/lib/downloads'
import { DownloadCard } from '@/components/DownloadCard'
import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Downloads',
  description: '资源下载',
}

export default async function DownloadsPage() {
  const posts = await getDownloadPosts()

  return (
    <div className="relative overflow-hidden">
      <div className="deco-list">
        <div className="deco-list-bar" />
        <div className="deco-list-dots" />
        <div className="deco-list-orb deco-list-orb--a" />
        <div className="deco-list-orb deco-list-orb--b" />
      </div>
      <div className="mx-auto max-w-3xl px-6 py-16 relative z-[1]">
        <FadeUp>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Downloads</h1>
          <p className="text-gray-500 mb-10">资源分享与下载</p>
        </FadeUp>

        {posts.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No resources yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post, i) => (
              <FadeUp key={post.slug} delay={i * 0.08}>
                <DownloadCard post={post} />
              </FadeUp>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/downloads/page.tsx
git commit -m "feat: add downloads list page"
```

---

### Task 8: Create downloads detail page

**Files:**
- Create: `src/app/downloads/[slug]/page.tsx`

- [ ] **Step 1: Create `src/app/downloads/[slug]/page.tsx`**

```tsx
import { getDownloadPost, getDownloadPosts } from '@/lib/downloads'
import { MDXRenderer } from '@/components/MDXRenderer'
import { FileDownloadTable } from '@/components/FileDownloadTable'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = await getDownloadPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getDownloadPost(slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
  }
}

export default async function DownloadDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getDownloadPost(slug)

  if (!post) notFound()

  const { frontmatter, content, files } = post

  return (
    <div className="relative overflow-hidden">
      <div className="deco-post-glow deco-post-glow--a" />
      <div className="deco-post-glow deco-post-glow--b" />
      <div className="mx-auto max-w-article px-6 py-16 relative z-[1]">
        <Link
          href="/downloads/"
          className="inline-flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Downloads
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
            <time dateTime={frontmatter.date}>
              {format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
            </time>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {frontmatter.title}
          </h1>
          <div className="flex gap-1.5 flex-wrap">
            {frontmatter.tags?.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-600">
                {tag}
              </span>
            ))}
          </div>
        </header>

        {frontmatter.cover && (
          <div className="mb-10 rounded-xl overflow-hidden aspect-video bg-gray-100">
            <img src={frontmatter.cover} alt={frontmatter.title} className="w-full h-full object-cover" />
          </div>
        )}

        <article className="mb-12">
          <MDXRenderer source={content} />
        </article>

        <FileDownloadTable slug={slug} files={files} initialCount={0} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/downloads
git commit -m "feat: add downloads detail page"
```

---

### Task 9: Add Downloads nav link

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add Downloads link to the nav**

Change the `links` array in `src/components/Header.tsx` from:

```tsx
const links = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/essay', label: 'Essay' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
]
```

To:

```tsx
const links = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/essay', label: 'Essay' },
  { href: '/projects', label: 'Projects' },
  { href: '/downloads', label: 'Downloads' },
  { href: '/about', label: 'About' },
]
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add Downloads nav link"
```

---

## Phase 4: Sample Content

### Task 10: Create sample download resource

**Files:**
- Create: `content/downloads/example.mdx`

- [ ] **Step 1: Create `content/downloads/example.mdx`**

```mdx
---
title: "示例资源包"
date: "2026-08-09"
tags: ["示例", "资源"]
summary: "这是一个示例资源，展示下载功能的格式。"
cover: ""
files:
  - name: "示例文件 v1.0"
    r2Key: "downloads/example/example-v1.zip"
  - name: "示例文件 v2.0"
    r2Key: "downloads/example/example-v2.zip"
---

## 资源介绍

这是一个示例资源，用于展示下载功能的 MDX 格式。

### 使用说明

1. 点击下方文件表格中的 **Download** 按钮
2. 浏览器会自动下载文件

<Callout type="info">
  文件存储在 Cloudflare R2，下载链接为预签名 URL，有效期 5 分钟。
</Callout>

### 包含内容

- 示例文件 v1.0
- 示例文件 v2.0
```

- [ ] **Step 2: Ensure `content/downloads/` directory exists and verify build**

```bash
mkdir -p content/downloads
```

```bash
npm run build
```

Expected: build passes. Check `out/downloads/index.html` and `out/downloads/example/index.html` exist.

- [ ] **Step 3: Commit**

```bash
git add content/downloads/example.mdx
git commit -m "feat: add sample download resource"
```

---

## Phase 5: Cloudflare Worker

### Task 11: Create Worker project scaffold

**Files:**
- Create: `cloudflare-worker/package.json`
- Create: `cloudflare-worker/tsconfig.json`
- Create: `cloudflare-worker/wrangler.toml`

- [ ] **Step 1: Create `cloudflare-worker/package.json`**

```json
{
  "name": "blog-download-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  },
  "dependencies": {
    "@cloudflare/workers-types": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `cloudflare-worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `cloudflare-worker/wrangler.toml`**

```toml
name = "blog-download-worker"
main = "src/index.ts"
compatibility_date = "2026-08-09"

[[r2_buckets]]
binding = "BLOG_DOWNLOADS"
bucket_name = "blog-downloads"

[[d1_databases]]
binding = "DB"
database_name = "blog-downloads-db"
database_id = ""  # fill after `wrangler d1 create`

[env.production]
routes = [
  { pattern = "dl.2assqw.cc/*", custom_domain = true }
]
```

- [ ] **Step 4: Install dependencies**

```bash
cd cloudflare-worker && npm install
```

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/
git commit -m "feat: scaffold Cloudflare Worker project"
```

---

### Task 12: Create Worker logic

**Files:**
- Create: `cloudflare-worker/src/index.ts`

- [ ] **Step 1: Create `cloudflare-worker/src/index.ts`**

```ts
export interface Env {
  BLOG_DOWNLOADS: R2Bucket
  DB: D1Database
}

// r2Key convention: downloads/<slug>/<filename>
// URL format: /dl/<slug>/<url-encoded-filename>
// Worker reconstructs the full r2Key from URL parameters.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // GET /dl/:slug/:fingerprint  (fingerprint = URL-encoded filename)
    const dlMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)$/)
    if (dlMatch) {
      const [, slug, fp] = dlMatch
      const filename = decodeURIComponent(fp)
      const r2Key = `downloads/${slug}/${filename}`

      try {
        // Verify file exists
        const head = await env.BLOG_DOWNLOADS.head(r2Key)
        if (!head) {
          return new Response('File not found', { status: 404 })
        }

        // Record download
        await env.DB.prepare(
          'INSERT INTO downloads (slug, r2_key) VALUES (?, ?)'
        ).bind(slug, r2Key).run()

        // Generate presigned URL (5 min expiry)
        const presigned = await env.BLOG_DOWNLOADS.createPresignedUrl({
          key: r2Key,
          method: 'GET',
          expiresIn: 300,
        })

        return new Response(null, {
          status: 307,
          headers: {
            Location: presigned,
            'Cache-Control': 'no-cache',
          },
        })
      } catch (e) {
        console.error('Download error:', e)
        return new Response('Internal error', { status: 500 })
      }
    }

    // GET /api/downloads/:slug/count
    const countMatch = url.pathname.match(/^\/api\/downloads\/([^/]+)\/count$/)
    if (countMatch) {
      const slug = countMatch[1]
      try {
        const result = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM downloads WHERE slug = ?'
        ).bind(slug).first<{ total: number }>()

        return Response.json({ slug, total: result?.total || 0 })
      } catch (e) {
        console.error('Count error:', e)
        return Response.json({ slug, total: 0 })
      }
    }

    return new Response('Not found', { status: 404 })
  },
}
```

- [ ] **Step 2: Verify Worker compiles**

```bash
cd cloudflare-worker && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add cloudflare-worker/src/index.ts
git commit -m "feat: implement download Worker logic"
```

---

## Phase 6: Integration

### Task 13: Verify full build

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: `tsx scripts/fetch-r2-meta.ts` runs (with warning — R2 may not be configured yet), then `next build` succeeds. Check `out/` contains:
- `out/downloads/index.html`
- `out/downloads/example/index.html`

- [ ] **Step 2: Verify all pages render correctly**

Check the generated HTML files exist and contain the expected content.

```bash
ls out/downloads/index.html out/downloads/example/index.html
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: finalize downloads feature integration"
```

---

## Post-Implementation: Cloudflare Setup

These steps require Cloudflare dashboard and wrangler CLI. Run them when ready to deploy:

```bash
# 1. Create R2 bucket (if not exists)
npx wrangler r2 bucket create blog-downloads

# 2. Create D1 database (if not exists) and get its ID
npx wrangler d1 create blog-downloads-db

# 3. Set the database_id in cloudflare-worker/wrangler.toml

# 4. Run schema
npx wrangler d1 execute blog-downloads-db --command "
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_downloads_slug ON downloads(slug);
"

# 5. Add DNS record for dl.2assqw.cc in Cloudflare dashboard

# 6. Deploy worker
cd cloudflare-worker && npm run deploy

# 7. Upload test file
npx wrangler r2 object put blog-downloads/downloads/example/example-v1.zip --file=./test-fixture.zip
```
