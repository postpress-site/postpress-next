export interface Page {
  id: string
  pageKey?: string
  title: string
  slug: string
  template: string
  blocks: Block[]
  slots?: Record<string, Block[]>
  contentBranch?: string
  meta: PageMeta
  parent?: { id: string; slug: string; title: string }
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

export interface Post {
  id: string
  title: string
  slug: string
  excerpt?: string
  featuredImage?: MediaItem
  content: RichTextContent
  author?: { id: string; name: string }
  categories: { id: string; name: string; slug: string }[]
  publishedDate?: string
  meta: PageMeta
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

export interface MediaItem {
  id: string
  url: string
  alt: string
  caption?: string
  width: number
  height: number
  sizes: {
    thumbnail?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    large?: { url: string; width: number; height: number }
    og?: { url: string; width: number; height: number }
  }
}

export interface NavItem {
  label: string
  url: string
  children?: NavItem[]
}

export interface SiteConfig {
  siteName: string
  tagline?: string
  logoUrl?: string
  faviconUrl?: string
  socialLinks: { platform: string; url: string }[]
}

export interface PageMeta {
  description?: string
  ogImageUrl?: string
  noIndex?: boolean
}

export interface Block {
  id: string
  blockType: string
  [key: string]: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RichTextContent = any

export interface CollectionQuery {
  page?: number
  limit?: number
  sort?: string
  where?: Record<string, unknown>
}

export interface CollectionResult<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface ContentFetchOptions {
  draft?: boolean
  pageKey?: string
  contentBranch?: string
}
