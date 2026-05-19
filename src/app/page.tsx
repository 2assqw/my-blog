import { getBlogPosts } from '@/lib/posts'
import { ArticleCard } from '@/components/ArticleCard'
import { FadeUp } from '@/components/FadeUp'
import Link from 'next/link'

export default async function HomePage() {
  const posts = await getBlogPosts()
  const recentPosts = posts.slice(0, 4)

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <section className="mb-20">
        <FadeUp>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Hi, I&apos;m <span className="text-brand">嘉年华</span>
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-lg text-gray-500 max-w-xl">
            前端开发者，热爱技术，也记录生活。这里是我的个人空间。
          </p>
        </FadeUp>
        <FadeUp delay={0.2}>
          <div className="flex gap-3 mt-6">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Read Blog
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              View Projects
            </Link>
          </div>
        </FadeUp>
      </section>

      {recentPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold text-gray-900">Recent Posts</h2>
            <Link
              href="/blog"
              className="text-sm text-brand hover:text-brand-600 transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {recentPosts.map((post) => (
              <ArticleCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
