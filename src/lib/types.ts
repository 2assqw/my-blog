export interface PostFrontmatter {
  title: string
  date: string
  tags: string[]
  summary: string
  draft?: boolean
}

export interface Post {
  slug: string
  frontmatter: PostFrontmatter
  content: string
  type: 'blog' | 'essay'
}

export interface Project {
  slug: string
  name: string
  description: string
  tags: string[]
  links: {
    live?: string
    github?: string
  }
  image?: string
}
