'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/essay', label: 'Essay' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'About' },
]

export function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`
        sticky top-0 z-50 transition-all duration-300
        ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'}
      `}
    >
      <div className="mx-auto max-w-3xl px-6">
        <nav className={`flex items-center gap-6 transition-all duration-300 ${
          scrolled ? 'h-14' : 'h-16'
        }`}>
          <Link
            href="/"
            className="font-semibold text-lg text-gray-900 shrink-0"
          >
            My Blog
          </Link>
          <div className="flex gap-1 overflow-x-auto">
            {links.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-gray-100 text-brand'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </header>
  )
}
