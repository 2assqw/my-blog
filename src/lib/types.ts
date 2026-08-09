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

export interface DownloadFile {
  name: string
  r2Key: string
  size?: number
}

export interface DownloadPostFrontmatter {
  title: string
  date: string
  tags: string[]
  summary: string
  cover?: string
  draft?: boolean
}

export interface DownloadPost {
  slug: string
  frontmatter: DownloadPostFrontmatter
  files: DownloadFile[]
  content: string
}
