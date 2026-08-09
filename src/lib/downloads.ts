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
