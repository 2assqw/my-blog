import { getPost, getEssayPosts, getSeriesPosts } from '@/lib/posts'
import { MDXRenderer } from '@/components/MDXRenderer'
import { FontWeightControl } from '@/components/FontWeightControl'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
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

  let prevChapter: { slug: string; title: string } | null = null
  let nextChapter: { slug: string; title: string } | null = null

  if (frontmatter.series) {
    const chapters = await getSeriesPosts(frontmatter.series)
    const idx = chapters.findIndex((c) => c.slug === slug)
    if (idx > 0) {
      prevChapter = { slug: chapters[idx - 1].slug, title: chapters[idx - 1].frontmatter.title }
    }
    if (idx < chapters.length - 1) {
      nextChapter = { slug: chapters[idx + 1].slug, title: chapters[idx + 1].frontmatter.title }
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="deco-post-glow deco-post-glow--a" />
      <div className="deco-post-glow deco-post-glow--b" />
      <div className="mx-auto max-w-article px-6 py-16 relative z-[1]">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/essay/"
            className="inline-flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Essay
          </Link>
          <FontWeightControl />
        </div>

        <header className="mb-10">
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
            <time dateTime={frontmatter.date}>
              {format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
            </time>
            {frontmatter.series && (
              <>
                <span>·</span>
                <Link
                  href={`/essay/series/${encodeURIComponent(frontmatter.series)}`}
                  className="text-brand hover:text-brand-600 transition-colors"
                >
                  {frontmatter.series}
                </Link>
                {frontmatter.chapter && (
                  <span>· 第{frontmatter.chapter}章</span>
                )}
              </>
            )}
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

        <article style={{ fontWeight: 'var(--essay-font-weight, 400)' }}>
          <MDXRenderer source={content} />
        </article>

        {(prevChapter || nextChapter) && (
          <nav className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
            <div className="flex justify-between gap-4">
              {prevChapter ? (
                <Link
                  href={`/essay/${prevChapter.slug}`}
                  className="flex-1 group"
                >
                  <span className="text-xs text-gray-400">← 上一章</span>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1 group-hover:text-brand transition-colors line-clamp-1">
                    {prevChapter.title}
                  </p>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
              {nextChapter ? (
                <Link
                  href={`/essay/${nextChapter.slug}`}
                  className="flex-1 group text-right"
                >
                  <span className="text-xs text-gray-400">下一章 →</span>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1 group-hover:text-brand transition-colors line-clamp-1">
                    {nextChapter.title}
                  </p>
                </Link>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
