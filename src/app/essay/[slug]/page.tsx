import { getPost, getEssayPosts } from '@/lib/posts'
import { MDXRenderer } from '@/components/MDXRenderer'
import { BookReader } from '@/components/BookReader'
import { format, parseISO } from 'date-fns'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

function splitContent(raw: string, targetChars: number): string[] {
  const pages: string[] = []
  let current = ''
  let inFence = false

  const blocks = raw.split(/\n\n+/)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (trimmed.startsWith('```')) {
      inFence = !inFence
    }

    if (!inFence && current && current.length + trimmed.length > targetChars + 200) {
      pages.push(current.trim())
      current = trimmed
    } else {
      current += (current ? '\n\n' : '') + trimmed
    }
  }

  if (current.trim()) pages.push(current.trim())
  return pages.length > 0 ? pages : [raw]
}

export async function generateStaticParams() {
  const posts = await getEssayPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost('essay', slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
  }
}

export default async function EssayDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost('essay', slug)

  if (!post) notFound()

  const { frontmatter, content } = post
  const rawPages = splitContent(content, 1000)

  // Render each page through MDXRenderer at build time
  const renderedPages = rawPages.map((pageContent, i) => (
    <MDXRenderer key={i} source={pageContent} />
  ))

  return (
    <BookReader
      title={frontmatter.title}
      date={format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
      backHref="/essay/"
      backLabel="Back to Essay"
      pages={renderedPages}
    />
  )
}
