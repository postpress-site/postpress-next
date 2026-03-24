export { definePostpressConfig, type PostpressConfig } from './lib/config'
export {
  createPostpressHandlers,
  createPostpressRouter,
  type PostpressHandlers,
  type PostpressRouter,
} from './lib/handlers'
export { verifyPostpressJwt, type PostpressJwtClaims } from './lib/jwt'
export { postpressTag } from './lib/tags'
export {
  stableStringify,
  sha256Hex,
  type BlockFieldOption,
  type BlockFieldConfig,
  type BlockConfigForManifest,
  type SiteBlocksManifest,
  normalizeBlockConfigs,
  createBlocksManifest,
} from './lib/manifest'
export type {
  SiteManifest,
  SiteManifestTemplate,
  SiteManifestPage,
  SiteManifestSlot,
  SiteManifestDefaultBlock,
} from './lib/site-manifest-types'

// Content provider
export type { ContentProvider } from './lib/content/provider'
export { PayloadContentProvider } from './lib/content/payload-provider'
export type {
  Page,
  Post,
  Block,
  NavItem,
  SiteConfig,
  MediaItem,
  CollectionQuery,
  CollectionResult,
  ContentFetchOptions,
} from './lib/content/types'

// Template helpers
export { flattenBlock, getLayoutBlocks, type LayoutBlocks } from './lib/template-helpers'

// Components
export { BlockRenderer } from './components/BlockRenderer'
