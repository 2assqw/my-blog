import { getPost, getEssayPosts } from '@/lib/posts'
import { MDXRenderer } from '@/components/MDXRenderer'
import { BookReader } from '@/components/BookReader'
import { format, parseISO } from 'date-fns'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
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

  return (
    <BookReader
      title={frontmatter.title}
      date={format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
      backHref="/essay/"
      backLabel="Back to Essay"
    >
      <MDXRenderer source={content} />
    </BookReader>
  )
}
