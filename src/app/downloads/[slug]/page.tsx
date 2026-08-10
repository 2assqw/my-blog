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
          Back
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
