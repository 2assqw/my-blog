import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import type { Post, PostFrontmatter } from './types'

const CONTENT_ROOT = path.join(process.cwd(), 'content')

async function readPostsFromDir(
  dir: string,
  type: 'blog' | 'essay'
): Promise<Post[]> {
  const dirPath = path.join(CONTENT_ROOT, dir)
  try {
    const files = await fs.readdir(dirPath)
    const mdxFiles = files.filter((f) => /\.mdx?$/.test(f))

    const posts = await Promise.all(
      mdxFiles.map(async (filename) => {
        const filePath = path.join(dirPath, filename)
        const raw = await fs.readFile(filePath, 'utf-8')
        const { data, content } = matter(raw)
        const frontmatter = data as PostFrontmatter
        const slug = filename.replace(/\.mdx?$/, '')
        // normalize date: gray-matter may parse it as Date, string, or number
        if (frontmatter.date) {
          frontmatter.date = new Date(frontmatter.date).toISOString().slice(0, 10)
        }

        return { slug, frontmatter, content, type }
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

export async function getBlogPosts(): Promise<Post[]> {
  return readPostsFromDir('blog', 'blog')
}

export async function getEssayPosts(): Promise<Post[]> {
  return readPostsFromDir('essay', 'essay')
}

export async function getPost(
  type: 'blog' | 'essay',
  slug: string
): Promise<Post | null> {
  const dir = type === 'blog' ? 'blog' : 'essay'
  const filePath = path.join(CONTENT_ROOT, dir, `${slug}.mdx`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const { data, content } = matter(raw)
    const frontmatter = data as PostFrontmatter
    if (frontmatter.date) {
      frontmatter.date = new Date(frontmatter.date).toISOString().slice(0, 10)
    }
    return {
      slug,
      frontmatter,
      content,
      type,
    }
  } catch {
    return null
  }
}
