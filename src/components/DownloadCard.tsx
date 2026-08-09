import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { DownloadPost } from '@/lib/types'

interface DownloadCardProps {
  post: DownloadPost
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function DownloadCard({ post }: DownloadCardProps) {
  const { frontmatter, slug, files } = post
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  const href = `/downloads/${slug}`

  return (
    <Link href={href} className="group block">
      <article className="rounded-xl border border-gray-100 bg-white overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-gray-200">
        {frontmatter.cover && (
          <div className="aspect-video bg-gray-100 overflow-hidden">
            <img
              src={frontmatter.cover}
              alt={frontmatter.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
            <time dateTime={frontmatter.date}>
              {format(parseISO(frontmatter.date), 'yyyy-MM-dd')}
            </time>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand transition-colors mb-2">
            {frontmatter.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {frontmatter.summary}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {frontmatter.tags?.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-600">
                  {tag}
                </span>
              ))}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {files.length} file{files.length !== 1 ? 's' : ''}{totalSize > 0 ? ` · ${formatSize(totalSize)}` : ''}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
