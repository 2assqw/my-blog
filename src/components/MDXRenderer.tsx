import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import { Callout } from './Callout'
import { CodeBlock } from './CodeBlock'
import Link from 'next/link'

const components = {
  Callout,
  CodeBlock,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const href = props.href || '#'
    const isExternal = href.startsWith('http')
    if (isExternal) {
      return (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline decoration-brand/30 hover:decoration-brand transition-colors"
        />
      )
    }
    return (
      <Link
        href={href}
        className="text-brand underline decoration-brand/30 hover:decoration-brand transition-colors"
      >
        {props.children}
      </Link>
    )
  },
}

interface MDXRendererProps {
  source: string
}

export function MDXRenderer({ source }: MDXRendererProps) {
  return (
    <div className="prose prose-gray max-w-none">
      <MDXRemote
        source={source}
        components={components}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
          },
        }}
      />
    </div>
  )
}
