import { getSeriesPosts } from '@/lib/posts'
import { FadeUp } from '@/components/FadeUp'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ name: string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const seriesName = decodeURIComponent(name.join('/'))
  return {
    title: seriesName,
    description: `连载：${seriesName}`,
  }
}

export default async function SeriesPage({ params }: Props) {
  const { name } = await params
  const seriesName = decodeURIComponent(name.join('/'))
  const chapters = await getSeriesPosts(seriesName)

  if (chapters.length === 0) notFound()

  return (
    <div className="relative overflow-hidden">
      <div className="deco-post-glow deco-post-glow--a" />
      <div className="deco-post-glow deco-post-glow--b" />
      <div className="mx-auto max-w-article px-6 py-16 relative z-[1]">
        <Link
          href="/essay/"
          className="inline-flex items-center text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back to Essay
        </Link>

        <FadeUp>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{seriesName}</h1>
          <p className="text-gray-500 mb-2">共 {chapters.length} 章</p>
        </FadeUp>

        <div className="mt-10 space-y-1">
          {chapters.map((ch, i) => (
            <FadeUp key={ch.slug} delay={i * 0.05}>
              <Link
                href={`/essay/${ch.slug}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xs text-gray-400 w-8 shrink-0">
                    第{ch.frontmatter.chapter}章
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate group-hover:text-brand transition-colors">
                      {ch.frontmatter.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(parseISO(ch.frontmatter.date), 'yyyy-MM-dd')}
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-brand transition-colors shrink-0 ml-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </FadeUp>
          ))}
        </div>
      </div>
    </div>
  )
}
