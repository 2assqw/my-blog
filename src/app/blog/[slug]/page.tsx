import { getPost, getBlogPosts } from '@/lib/posts'
import { MDXRenderer } from '@/components/MDXRenderer'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = await getBlogPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost('blog', slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
  }
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost('blog', slug)

  if (!post) notFound()

  const { frontmatter, content } = post

  return (
    <div className="mx-auto max-w-article px-6 py-16">
      <Link
        href="/blog"
        className="inline-flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Blog
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
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      <article>
        <MDXRenderer source={content} />
      </article>
    </div>
  )
}
