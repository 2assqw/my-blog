import { getEssayPosts } from '@/lib/posts'
import { ArticleCard } from '@/components/ArticleCard'
import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Essay',
  description: '生活随笔',
}

export default async function EssayPage() {
  const posts = await getEssayPosts()

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <FadeUp>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Essay</h1>
        <p className="text-gray-500 mb-10">生活随笔与日常记录</p>
      </FadeUp>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No essays yet.</p>
      ) : (
        <div className="grid gap-4">
          {posts.map((post, i) => (
            <FadeUp key={post.slug} delay={i * 0.08}>
              <ArticleCard post={post} />
            </FadeUp>
          ))}
        </div>
      )}
    </div>
  )
}
