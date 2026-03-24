import type { SiteBlocksManifest } from './manifest'
import type { SiteManifest } from './site-manifest-types'

export type PostpressConfig = {
  siteId: string
  publicKeyPem: string
  issuer?: string | string[]
  buildBlocksManifest: () => Promise<SiteBlocksManifest>
  buildSiteManifest: () => Promise<SiteManifest>
}

export function definePostpressConfig(config: PostpressConfig): PostpressConfig {
  const siteId = config.siteId?.trim()
  if (!siteId) throw new Error('PostPress config missing siteId')
  const publicKeyPem = config.publicKeyPem?.trim()
  if (!publicKeyPem) throw new Error('PostPress config missing publicKeyPem')
  return {
    ...config,
    siteId,
    publicKeyPem,
    issuer: config.issuer ?? 'postpress_cms',
  }
}

