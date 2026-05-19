import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { Post } from '@/lib/types'

interface ArticleCardProps {
  post: Post
}

export function ArticleCard({ post }: ArticleCardProps) {
  const { frontmatter, slug, type } = post
  const href = type === 'blog' ? `/blog/${slug}` : `/essay/${slug}`

  return (
    <Link href={href} className="group block">
      <article className="rounded-xl border border-gray-100 bg-white p-6 transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-gray-200">
        <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
          <time dateTime={frontmatter.date}>
            {format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
          </time>
          <span className="uppercase text-xs tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {type === 'blog' ? 'Blog' : 'Essay'}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand transition-colors mb-2">
          {frontmatter.title}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
          {frontmatter.summary}
        </p>
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
      </article>
    </Link>
  )
}
