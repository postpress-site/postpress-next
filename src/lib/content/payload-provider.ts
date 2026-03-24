import type {
  Block,
  Page,
  Post,
  NavItem,
  SiteConfig,
  MediaItem,
  CollectionQuery,
  CollectionResult,
  ContentFetchOptions,
} from './types'
import type { ContentProvider } from './provider'
import { postpressTag } from '../tags'

export class PayloadContentProvider implements ContentProvider {
  private baseUrl: string
  private apiRoot: string
  private apiKey?: string
  private contentBranch: string

  constructor(config: { baseUrl: string; apiKey?: string; contentBranch?: string }) {
    this.baseUrl = config.baseUrl
    this.apiRoot = `${this.baseUrl}/api/website`
    this.apiKey = config.apiKey
    this.contentBranch = (config.contentBranch || 'main').trim() || 'main'
  }

  private resolveMediaUrl(url: string | undefined): string | undefined {
    if (!url) return undefined
    if (url.startsWith('http')) return url
    return `${this.baseUrl}${url}`
  }

  private async fetch<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>,
    tags?: string[],
  ): Promise<T> {
    const url = new URL(`${this.apiRoot}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) url.searchParams.set(k, String(v))
      })
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
    headers['X-PostPress-Content-Branch'] = this.contentBranch

    const res = await fetch(url.toString(), {
      headers,
      next: { tags: [...new Set([endpoint, ...(tags || [])])] },
    } as RequestInit)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Content API error: ${res.status} ${url.toString()} — ${body.slice(0, 200)}`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const bodySnippet = (await res.text()).slice(0, 120)
      throw new Error(`Content API non-JSON response for ${endpoint}: ${bodySnippet}`)
    }
    return res.json()
  }

  private async getPageFromQuery(
    where: Record<string, string>,
    options?: ContentFetchOptions,
    tags?: string[],
  ): Promise<Page | null> {
    const params: Record<string, string> = {
      depth: '2',
      ...where,
    }
    if (options?.draft) params['draft'] = 'true'

    const result = await this.fetch<{ docs: unknown[] }>('/pages', params, tags)
    if (!result.docs.length) return null
    return this.transformPage(result.docs[0])
  }

  async getPage(slug: string, options?: ContentFetchOptions): Promise<Page | null> {
    const branch = (options?.contentBranch || this.contentBranch || 'main').trim() || 'main'
    const pageKey = options?.pageKey?.trim()
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    const pageTag = pageKey
      ? postpressTag.pageKey(siteId, pageKey)
      : postpressTag.global(siteId, `pageSlug:${slug}`)

    const primaryWhere: Record<string, string> = {
      'where[contentBranch][equals]': branch,
    }
    if (pageKey && pageKey.length > 0) {
      primaryWhere['where[pageKey][equals]'] = pageKey
    } else {
      primaryWhere['where[slug][equals]'] = slug
    }

    const page = await this.getPageFromQuery(primaryWhere, options, [pageTag])
    if (page) return page

    if (branch !== 'main') {
      const fallbackWhere: Record<string, string> = {
        'where[contentBranch][equals]': 'main',
      }
      if (pageKey && pageKey.length > 0) {
        fallbackWhere['where[pageKey][equals]'] = pageKey
      } else {
        fallbackWhere['where[slug][equals]'] = slug
      }
      return this.getPageFromQuery(fallbackWhere, options, [pageTag])
    }

    return null
  }

  async getPages(query?: CollectionQuery, options?: ContentFetchOptions): Promise<CollectionResult<Page>> {
    const branch = (options?.contentBranch || this.contentBranch || 'main').trim() || 'main'
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    const params: Record<string, string | number> = {
      limit: query?.limit || 20,
      sort: query?.sort || '-updatedAt',
      'where[contentBranch][equals]': branch,
    }
    if (query?.page) params['page'] = query.page
    if (!options?.draft) params['where[_status][equals]'] = 'published'

    const result = await this.fetch<CollectionResult<unknown>>('/pages', params, [
      postpressTag.global(siteId, 'pages'),
    ])
    return {
      ...result,
      docs: result.docs.map((doc) => this.transformPage(doc)),
    }
  }

  async getPost(slug: string, options?: ContentFetchOptions): Promise<Post | null> {
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    const params: Record<string, string> = {
      'where[slug][equals]': slug,
      depth: '2',
    }
    if (options?.draft) params['draft'] = 'true'

    const result = await this.fetch<{ docs: unknown[] }>('/posts', params, [postpressTag.post(siteId, slug)])
    if (!result.docs.length) return null
    return this.transformPost(result.docs[0])
  }

  async getPosts(query?: CollectionQuery, options?: ContentFetchOptions): Promise<CollectionResult<Post>> {
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    const params: Record<string, string | number> = {
      limit: query?.limit || 20,
      sort: query?.sort || '-publishedDate',
    }
    if (query?.page) params['page'] = query.page
    if (!options?.draft) params['where[_status][equals]'] = 'published'

    const result = await this.fetch<CollectionResult<unknown>>('/posts', params, [
      postpressTag.listing(siteId, 'blog'),
    ])
    return {
      ...result,
      docs: result.docs.map((doc) => this.transformPost(doc)),
    }
  }

  async getNavigation(id: 'main' | 'footer'): Promise<NavItem[]> {
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    let result: Record<string, unknown>
    try {
      result = await this.fetch<Record<string, unknown>>('/globals/navigation', undefined, [
        postpressTag.global(siteId, 'nav'),
      ])
    } catch {
      // Keep page rendering even if globals are unavailable or misconfigured.
      return []
    }
    const navKey = id === 'main' ? 'mainNav' : 'footerNav'
    return this.transformNav((result[navKey] as unknown[]) || [])
  }

  async getSiteConfig(): Promise<SiteConfig> {
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    let result: Record<string, unknown>
    try {
      result = await this.fetch<Record<string, unknown>>('/globals/site-config', undefined, [
        postpressTag.global(siteId, 'site-config'),
      ])
    } catch {
      // Keep page rendering even if globals are unavailable or misconfigured.
      return {
        siteName: 'PostPress',
        tagline: undefined,
        logoUrl: undefined,
        faviconUrl: undefined,
        socialLinks: [],
      }
    }
    const logo = result.logo as Record<string, unknown> | undefined
    const favicon = result.favicon as Record<string, unknown> | undefined
    return {
      siteName: result.siteName as string,
      tagline: result.tagline as string | undefined,
      logoUrl: this.resolveMediaUrl(logo?.url as string | undefined),
      faviconUrl: this.resolveMediaUrl(favicon?.url as string | undefined),
      socialLinks: (result.socialLinks as { platform: string; url: string }[]) || [],
    }
  }

  async getGlobal(key: string, options?: { draft?: boolean }): Promise<Record<string, unknown> | null> {
    const siteId = (process.env.POSTPRESS_SITE_ID || 'site').trim() || 'site'
    const params = options?.draft ? { draft: 'true' } : undefined
    try {
      return await this.fetch<Record<string, unknown>>(`/globals/${key}`, params, [
        postpressTag.global(siteId, key),
      ])
    } catch {
      return null
    }
  }

  async getMediaUrl(id: string, size?: string): Promise<string> {
    const result = await this.fetch<Record<string, unknown>>(`/media/${id}`)
    const sizes = result.sizes as Record<string, { url: string }> | undefined
    if (size && sizes?.[size]) return this.resolveMediaUrl(sizes[size].url)!
    return this.resolveMediaUrl(result.url as string)!
  }

  // --- Transform helpers ---

  private buildLegacyLayoutData(entry: Record<string, unknown>): Record<string, unknown> {
    const blockType = typeof entry.blockType === 'string' ? entry.blockType : ''
    if (blockType === 'rich-text') {
      return entry.content !== undefined ? { content: entry.content } : {}
    }
    if (blockType === 'hero') {
      return {
        ...(entry.heading !== undefined ? { heading: entry.heading } : {}),
        ...(entry.subheading !== undefined ? { subheading: entry.subheading } : {}),
        ...(entry.backgroundImage !== undefined ? { backgroundImage: entry.backgroundImage } : {}),
        ...(entry.ctaText !== undefined ? { ctaText: entry.ctaText } : {}),
        ...(entry.ctaLink !== undefined ? { ctaLink: entry.ctaLink } : {}),
        ...(entry.heroStyle !== undefined ? { style: entry.heroStyle } : {}),
      }
    }
    if (blockType === 'image') {
      return {
        ...(entry.image !== undefined ? { image: entry.image } : {}),
        ...(entry.caption !== undefined ? { caption: entry.caption } : {}),
        ...(entry.imageSize !== undefined ? { size: entry.imageSize } : {}),
      }
    }
    if (blockType === 'cta') {
      return {
        ...(entry.heading !== undefined ? { heading: entry.heading } : {}),
        ...(entry.body !== undefined ? { body: entry.body } : {}),
        ...(entry.buttonText !== undefined ? { buttonText: entry.buttonText } : {}),
        ...(entry.buttonLink !== undefined ? { buttonLink: entry.buttonLink } : {}),
        ...(entry.ctaStyle !== undefined ? { style: entry.ctaStyle } : {}),
      }
    }
    return {}
  }

  private transformPage(doc: unknown): Page {
    const d = doc as Record<string, unknown>
    const layoutBlocks = (d.layout as Record<string, unknown>[]) || []
    const slotBlocks = (d.slots as Record<string, Record<string, unknown>[]>) || {}
    const legacyBlocks = (d.blocks as Record<string, unknown>[]) || []
    const legacyContent = d.content
    const blocks: Block[] =
      layoutBlocks.length > 0
        ? layoutBlocks.map((entry) => {
            const data =
              entry.data && typeof entry.data === 'object' ? (entry.data as Record<string, unknown>) : {}
            const legacyData = this.buildLegacyLayoutData(entry)
            const fallbackId =
              typeof entry.blockType === 'string' ? `layout-${entry.blockType}` : 'layout-block'
            return {
              id: (entry.id as string) || fallbackId,
              blockType: entry.blockType as string,
              ...legacyData,
              ...(data || {}),
            } as Block
          })
        : Object.keys(slotBlocks).length > 0
          ? Object.values(slotBlocks)
              .flatMap((entries) => entries || [])
              .map((entry) => {
                const row = (entry as Record<string, unknown>) || {}
                const data =
                  row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
                return {
                  id: (row.id as string) || `slot-${String(row.blockType || 'block')}`,
                  blockType: (row.blockType as string) || 'unknown',
                  ...(data || {}),
                } as Block
              })
        : legacyBlocks.length > 0
          ? (legacyBlocks as Block[])
          : legacyContent
            ? ([{ id: 'legacy-content', blockType: 'rich-text', content: legacyContent }] as Block[])
            : []
    const meta = (d.meta as Record<string, unknown>) || {}
    const ogImage = meta.ogImage as Record<string, unknown> | undefined
    const parent = d.parent as Record<string, unknown> | undefined
    const normalizedSlots: Record<string, Block[]> = Object.fromEntries(
      Object.entries(slotBlocks).map(([slotSlug, entries]) => [
        slotSlug,
        (entries || []).map((entry) => {
          const row = (entry as Record<string, unknown>) || {}
          const data =
            row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
          return this.resolveBlockMediaUrls({
            id: (row.id as string) || `slot-${String(row.blockType || 'block')}`,
            blockType: (row.blockType as string) || 'unknown',
            ...(data || {}),
          }) as Block
        }),
      ]),
    )

    return {
      id: d.id as string,
      pageKey: d.pageKey as string | undefined,
      title: d.title as string,
      slug: d.slug as string,
      template: (d.template as string) || 'default',
      blocks: blocks.map((b) =>
        this.resolveBlockMediaUrls({
          ...b,
          id: b.id as string,
          blockType: b.blockType as string,
        }) as Block
      ),
      slots: normalizedSlots,
      meta: {
        description: meta.description as string | undefined,
        ogImageUrl: this.resolveMediaUrl(
          (ogImage?.sizes as Record<string, { url: string }> | undefined)?.og?.url || (ogImage?.url as string | undefined)
        ),
        noIndex: meta.noIndex as boolean | undefined,
      },
      parent: parent
        ? {
            id: parent.id as string,
            slug: parent.slug as string,
            title: parent.title as string,
          }
        : undefined,
      status: d._status as 'draft' | 'published',
      contentBranch: d.contentBranch as string | undefined,
      createdAt: d.createdAt as string,
      updatedAt: d.updatedAt as string,
    }
  }

  private transformPost(doc: unknown): Post {
    const d = doc as Record<string, unknown>
    const meta = (d.meta as Record<string, unknown>) || {}
    const ogImage = meta.ogImage as Record<string, unknown> | undefined
    const featImg = d.featuredImage as Record<string, unknown> | undefined
    const author = d.author as Record<string, unknown> | undefined
    const categories = (d.categories as Record<string, unknown>[]) || []

    return {
      id: d.id as string,
      title: d.title as string,
      slug: d.slug as string,
      excerpt: d.excerpt as string | undefined,
      featuredImage: featImg
        ? this.resolveMediaItemUrls({
            id: featImg.id as string,
            url: featImg.url as string,
            alt: featImg.alt as string,
            caption: featImg.caption as string | undefined,
            width: featImg.width as number,
            height: featImg.height as number,
            sizes: featImg.sizes as MediaItem['sizes'],
          })
        : undefined,
      content: d.content,
      author: author ? { id: author.id as string, name: author.name as string } : undefined,
      categories: categories.map((c) => ({
        id: c.id as string,
        name: c.name as string,
        slug: c.slug as string,
      })),
      publishedDate: d.publishedDate as string | undefined,
      meta: {
        description: meta.description as string | undefined,
        ogImageUrl: this.resolveMediaUrl(
          (ogImage?.sizes as Record<string, { url: string }> | undefined)?.og?.url || (ogImage?.url as string | undefined)
        ),
      },
      status: d._status as 'draft' | 'published',
      createdAt: d.createdAt as string,
      updatedAt: d.updatedAt as string,
    }
  }

  private resolveMediaItemUrls(item: MediaItem): MediaItem {
    return {
      ...item,
      url: this.resolveMediaUrl(item.url)!,
      sizes: Object.fromEntries(
        Object.entries(item.sizes || {}).map(([key, val]) => [
          key,
          val ? { ...val, url: this.resolveMediaUrl(val.url)! } : val,
        ])
      ) as MediaItem['sizes'],
    }
  }

  private resolveBlockMediaUrls(block: Record<string, unknown>): Record<string, unknown> {
    const resolved = { ...block }
    for (const [key, val] of Object.entries(resolved)) {
      if (val && typeof val === 'object' && 'url' in (val as Record<string, unknown>)) {
        const media = val as Record<string, unknown>
        resolved[key] = {
          ...media,
          url: this.resolveMediaUrl(media.url as string),
          ...(media.sizes ? {
            sizes: Object.fromEntries(
              Object.entries(media.sizes as Record<string, { url: string }>).map(([k, v]) => [
                k,
                v ? { ...v, url: this.resolveMediaUrl(v.url)! } : v,
              ])
            ),
          } : {}),
        }
      }
    }
    return resolved as Record<string, unknown>
  }

  private transformNav(items: unknown[]): NavItem[] {
    return (items as Record<string, unknown>[]).map((item) => {
      const link = item.link as Record<string, unknown> | undefined
      const children = item.children as unknown[] | undefined
      return {
        label: item.label as string,
        url: link?.slug ? `/${link.slug}` : (item.url as string) || '#',
        children: children?.length ? this.transformNav(children) : undefined,
      }
    })
  }
}
