# BookReader — 文章翻页阅读器

**Status:** designed, pending plan  
**Date:** 2026-06-01

## Overview

将 blog 和 essay 文章详情页改造为类似 iOS Books 的翻书阅读体验。每页约 1000 字，段落感知分页，3D 卷页动画。

## Layout

```
+------------------------------------+
| ← Back to Blog   Title    Date     |  top bar (8px padding)
+------------------------------------+
|   [<]  |  page content  |  [>]    |  page area
|  12.5% |     75%        |  12.5%  |  click zones + card
+------------------------------------+
|     ←        3/8        →         |  bottom bar (8px padding)
+------------------------------------+
```

- Page card: white background, box-shadow, right-edge spine gradient
- Hot zones: 12.5% width each side, transparent by default
- On hover: subtle brand gradient background + arrow icon appears with scale/opacity transition

## Interactions

| Trigger | Action |
|---|---|
| Click left hot zone | Flip to previous page |
| Click right hot zone | Flip to next page |
| Keyboard ← | Flip to previous page |
| Keyboard → | Flip to next page |
| Click page indicator "3/8" | Replace with `<input>`, type page number, Enter to jump |
| Mouse enter hot zone | Show subtle arrow with scale + opacity transition |
| Mouse leave hot zone | Arrow fades out |

## 3D Page Flip Animation

- Container: `perspective: 1200px`
- Duration: 400ms, `ease-in-out`
- Forward: current page `rotateY(-90deg)` + fade left; next page `rotateY(90deg) → 0` + slide in from right
- Backward: reverse direction
- `transform-style: preserve-3d` on card wrapper
- Page content is pre-rendered — flip is pure CSS, no content re-render during animation

## Client-Side Pagination

BookReader receives full MDX HTML as `children` (ReactNode). On mount:

1. Walk DOM to extract top-level block nodes: `<p>`, `<h2>`, `<h3>`, `<pre>`, `<ul>`, `<blockquote>`
2. Accumulate text content length per node, split into pages at ~1000 chars
3. Break at paragraph boundaries — never split a block element across pages
4. Headings stick to the following paragraph (if heading + first para < 1200 chars, keep together)
5. Result: `pages: string[]` — each entry is innerHTML for one page

Edge cases:
- Single huge code block (>1000 chars): keeps on its own page, may exceed target
- Very short total content (<1000 chars): single page, no navigation shown
- Empty content: show "No content" placeholder

## Navigation Edge Cases

- First page: left arrow disabled (gray), left hot zone inactive
- Last page: right arrow disabled (gray), right hot zone inactive
- Invalid page jump (non-numeric, out of range): ignore, stay on current page

## Component Interface

```tsx
// src/components/BookReader.tsx
interface BookReaderProps {
  title: string
  date: string
  backHref: string
  backLabel: string
  children: React.ReactNode  // full MDX-rendered content
}

export function BookReader({ title, date, backHref, backLabel, children }: BookReaderProps)
```

## File Changes

| File | Change |
|---|---|
| `src/components/BookReader.tsx` | New — client component with all logic |
| `src/app/blog/[slug]/page.tsx` | Wrap content in `<BookReader>` |
| `src/app/essay/[slug]/page.tsx` | Wrap content in `<BookReader>` |
| `src/app/globals.css` | Add page flip keyframes and hot zone styles |

## CSS (globals.css additions)

```css
/* 3D flip perspective */
.book-reader-stage { perspective: 1200px; }
.book-reader-card { transform-style: preserve-3d; backface-visibility: hidden; }

/* Flip keyframes */
@keyframes flip-out-left { to { transform: rotateY(-90deg) translateX(-25%); opacity: 0; } }
@keyframes flip-in-right { from { transform: rotateY(90deg) translateX(25%); opacity: 0.5; } }

/* Hot zone arrow */
.book-reader-arrow { opacity: 0; transform: scale(0.8); transition: opacity 0.2s linear, transform 0.2s linear; }
.book-reader-hotzone:hover .book-reader-arrow { opacity: 0.6; transform: scale(1); }
```

## Non-Goals

- Touch/swipe gestures (not requested)
- Mobile-specific responsive layout (works on desktop primarily)
- Animations disabled preference
- Persisting last-read page across sessions
