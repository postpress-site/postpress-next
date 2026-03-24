import type {
  Page,
  Post,
  NavItem,
  SiteConfig,
  CollectionQuery,
  CollectionResult,
  ContentFetchOptions,
} from './types'

export interface ContentProvider {
  getPage(slug: string, options?: ContentFetchOptions): Promise<Page | null>
  getPages(query?: CollectionQuery, options?: ContentFetchOptions): Promise<CollectionResult<Page>>

  getPost(slug: string, options?: ContentFetchOptions): Promise<Post | null>
  getPosts(query?: CollectionQuery, options?: ContentFetchOptions): Promise<CollectionResult<Post>>

  getNavigation(id: 'main' | 'footer'): Promise<NavItem[]>

  getSiteConfig(): Promise<SiteConfig>

  getGlobal(key: string, options?: { draft?: boolean }): Promise<Record<string, unknown> | null>

  getMediaUrl(id: string, size?: 'thumbnail' | 'medium' | 'large' | 'og'): Promise<string>
}
