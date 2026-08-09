import { getDownloadPosts } from '@/lib/downloads'
import { DownloadCard } from '@/components/DownloadCard'
import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Downloads',
  description: '资源下载',
}

export default async function DownloadsPage() {
  const posts = await getDownloadPosts()

  return (
    <div className="relative overflow-hidden">
      <div className="deco-list">
        <div className="deco-list-bar" />
        <div className="deco-list-dots" />
        <div className="deco-list-orb deco-list-orb--a" />
        <div className="deco-list-orb deco-list-orb--b" />
      </div>
      <div className="mx-auto max-w-3xl px-6 py-16 relative z-[1]">
        <FadeUp>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Downloads</h1>
          <p className="text-gray-500 mb-10">资源分享与下载</p>
        </FadeUp>

        {posts.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No resources yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post, i) => (
              <FadeUp key={post.slug} delay={i * 0.08}>
                <DownloadCard post={post} />
              </FadeUp>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
