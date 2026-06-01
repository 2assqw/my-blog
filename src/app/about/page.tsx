import { FadeUp } from '@/components/FadeUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: '关于我',
}

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="deco-about-sweep" />
      <div className="deco-about-glow" />
      <div className="mx-auto max-w-article px-6 py-16 relative z-[1]">
      <FadeUp>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">About</h1>
        <p className="text-gray-500 mb-10">关于我</p>
      </FadeUp>

      <div className="prose prose-gray max-w-none">
        <FadeUp delay={0.1}>
          <p>
            Hi，我是一名前端开发者。喜欢创造新东西，也喜欢记录生活中的思考。
          </p>
        </FadeUp>
        <FadeUp delay={0.2}>
          <h2>Skills</h2>
          <ul>
            <li>Trying: Vibe coding</li>
            <li>Language: C, C++(learning)</li>
            <li>Tools: Git, VS Code, AI</li>
          </ul>
        </FadeUp>
        <FadeUp delay={0.3}>
          <h2>Contact</h2>
          <p>
            GitHub:{' '}
            <a href="https://github.com/2assqw" target="_blank" rel="noopener noreferrer">
              @2assqw
            </a>
          </p>
          <p>
            E-mail:{' '}
            <a href="mailto:2782225993@qq.com">2782225993@qq.com</a>
            {' / '}
            <a href="mailto:dalepop828@gmail.com">dalepop828@gmail.com</a>
          </p>
          <h2>Favorite</h2>
          <ul>
            <li>Reading</li>
            <li>Eating</li>
          </ul>
        </FadeUp>
      </div>
      </div>
    </div>
  )
}
