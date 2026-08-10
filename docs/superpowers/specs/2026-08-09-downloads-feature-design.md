# Downloads Feature Design

**Date:** 2026-08-09
**Status:** Draft

## Overview

Add a resource-download section to the blog, similar to Chinese resource-sharing sites like sharelikes.com.cn. Files are stored on Cloudflare R2. The blog remains a pure SSG site — dynamic concerns (download counting, file serving) are handled by Cloudflare Workers + D1.

## Architecture

```
                   BUILD TIME                            RUNTIME

  R2 API ──→ scripts/fetch-r2-meta.ts                    User clicks [Download]
                 │                                             │
                 ▼                                             ▼
          content/r2-meta.json                    Worker GET /dl/:slug/:fp
                 │                                      │         │
                 ▼                                      ▼         ▼
  content/downloads/*.mdx ──→ Next.js build        INSERT D1    307 → R2 presigned URL
                 │
                 ▼
        Static HTML pages
```

---

## Content Layer

### Directory structure

```
content/downloads/
  example-resource.mdx      ← one MDX per resource

public/covers/               ← cover images (optional)
  example-cover.png
```

### MDX frontmatter schema

```yaml
---
title: "资源标题"
date: "2026-08-09"
tags: ["标签1", "标签2"]
summary: "卡片上的简短描述"
cover: "/covers/example-cover.png"
files:
  - name: "文件显示名称 v2.0"
    r2Key: "downloads/example/v2.zip"
  - name: "文件显示名称 v1.0"
    r2Key: "downloads/example/v1.zip"
---
## 资源详情
MDX 正文，支持 Callout、CodeBlock、图片等所有现有组件。
```

### Build-time R2 metadata script

**`scripts/fetch-r2-meta.ts`:**

- Reads all objects from R2 bucket via `wrangler r2 object list`
- Outputs `content/r2-meta.json`:

```json
{
  "downloads/example/v2.zip": { "size": 12582912, "etag": "abc123" },
  "downloads/example/v1.zip": { "size": 8388608, "etag": "def456" }
}
```

**`src/lib/posts.ts` (new: `getDownloadPosts`)**

- Parses all `content/downloads/*.mdx`
- Merges file metadata from `r2-meta.json` based on `r2Key`
- Returns `DownloadPost[]` with each file's real size from R2

**`package.json` build script:**

```json
"build": "tsx scripts/fetch-r2-meta.ts && next build"
```

---

## Pages

### Route: `/downloads` — Resource list

- Card grid (3 cols desktop, 2 cols tablet, 1 col mobile)
- Card shows: cover image (16:9), title, date, tags, file count + total size, download button linking to detail page
- Reuses `FadeUp` for scroll animation
- Empty state: "No resources yet."

### Route: `/downloads/[slug]` — Resource detail

Layout mirroring the blog detail page (`max-w-article`, deco-post-glow, back link).

**Section 1: MDX Body**
Title, date, tags, then `MDXRenderer` rendering the MDX content (resource description, screenshots, instructions, etc.)

**Section 2: File Table**

| File | Size | Download |
|------|------|----------|
| 插件包 v2.0 | 12 MB | [Download button] |
| 插件包 v1.0 | 8 MB | [Download button] |

Download button links to `https://dl.2assqw.cc/<slug>/<fingerprint>`, where fingerprint = URL-safe last segment of `r2Key`.

### Header nav

Add `{ href: '/downloads', label: 'Downloads' }` to nav links, placed between Projects and About.

---

## Cloudflare Components

### R2 Bucket

- Bucket name: `blog-downloads`
- File keys follow the `r2Key` values in MDX frontmatter
- No public access — files served only through Worker presigned URLs

### D1 Database

- Database name: `blog-downloads-db`

```sql
CREATE TABLE downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_downloads_slug ON downloads(slug);
```

### Worker (TypeScript)

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dl/:slug/:fingerprint` | Record download + 307 redirect |
| GET | `/api/downloads/:slug/count` | Return download count per slug |

**Download flow (`GET /dl/:slug/:fingerprint`):**

1. Look up `r2Key` from a hardcoded route map: `fingerprint → r2Key`
   - The fingerprint is the URL-safe encoded last segment of r2Key (e.g., `v2.zip` → `djEuemlw`)
2. `INSERT INTO downloads (slug, r2_key) VALUES (?, ?)`
3. Generate R2 presigned URL (5 min expiry)
4. Return 307 with `Location: <presigned-url>`
5. Browser downloads file; Worker logs count

**Count endpoint (`GET /api/downloads/:slug/count`):**

```json
{ "slug": "figma-plugins", "total": 142 }
```

Called at page load time via client-side fetch to show download count dynamically.

### Worker routing

- Domain: `dl.2assqw.cc` (subdomain of `2assqw.cc`, managed in Cloudflare)
- Worker bound to this route in `wrangler.toml`

---

## Type Definitions

```ts
// src/lib/types.ts additions

interface DownloadFile {
  name: string       // display name from frontmatter
  r2Key: string      // full R2 object key
  size?: number      // bytes, merged from r2-meta.json
}

interface DownloadPostFrontmatter {
  title: string
  date: string
  tags: string[]
  summary: string
  cover?: string
  draft?: boolean
}

interface DownloadPost {
  slug: string
  frontmatter: DownloadPostFrontmatter
  files: DownloadFile[]
  content: string
}
```

---

## Component Changes

### New components

- **`FileDownloadTable`** (server component) — renders the file table on detail page
- **`DownloadCard`** — list page card, analogous to `ArticleCard`

### Modified files

| File | Change |
|------|--------|
| `src/lib/posts.ts` | Add `getDownloadPosts()`, `getDownloadPost(slug)` |
| `src/lib/types.ts` | Add `DownloadFile`, `DownloadPostFrontmatter`, `DownloadPost` |
| `src/components/Header.tsx` | Add Downloads link |
| `package.json` | `build` script prepends R2 meta fetch |
| **New:** `scripts/fetch-r2-meta.ts` | Build-time R2 metadata fetcher |
| **New:** `src/app/downloads/page.tsx` | List page |
| **New:** `src/app/downloads/[slug]/page.tsx` | Detail page |
| **New:** `src/components/DownloadCard.tsx` | Card component |
| **New:** `src/components/FileDownloadTable.tsx` | File table (client component for download count) |
| **New:** `cloudflare-worker/` | Worker + wrangler.toml |

---

## Caveats

- **Download count is eventually consistent** — displayed via client-side fetch on page load; not prerendered
- **Build depends on R2 access** — CI/CD must have `wrangler` configured with R2 credentials
- **File size changes on R2 replacement require rebuild** — updating a file in R2 without rebuilding means displayed size is stale
- **No file integrity verification** — no checksums in v1; add later if needed

---

## Cloudflare Setup Steps

1. Install wrangler: `npm i -g wrangler`
2. Login: `wrangler login`
3. Ensure `2assqw.cc` is added to Cloudflare (DNS managed there)
4. Create R2 bucket: `wrangler r2 bucket create blog-downloads`
5. Create D1 database: `wrangler d1 create blog-downloads-db`
6. Create Worker project in `cloudflare-worker/`
7. Configure `wrangler.toml` with R2 binding, D1 binding, and route `dl.2assqw.cc/*`
8. Run D1 schema creation
9. Add DNS record: `dl.2assqw.cc` CNAME to Worker
10. Deploy worker: `wrangler deploy`
11. Upload files to R2: `wrangler r2 object put blog-downloads/<key> --file=<local-file>`
