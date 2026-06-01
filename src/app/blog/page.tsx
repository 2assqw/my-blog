import { getBlogPosts } from '@/lib/posts'
import { ArticleCard } from '@/components/ArticleCard'
import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog',
  description: '技术文章',
}

export default async function BlogPage() {
  const posts = await getBlogPosts()

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog</h1>
        <p className="text-gray-500 mb-10">技术文章与学习笔记</p>
      </FadeUp>

      {posts.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No posts yet.</p>
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
    </div>
  )
}
