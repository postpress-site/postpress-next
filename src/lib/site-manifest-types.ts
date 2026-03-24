import type { SiteBlocksManifest } from './manifest'

export type SiteManifestSlot = {
  slug: string
  label: string
  required?: boolean
  allowedBlocks?: string[]
  layout?: boolean
}

export type SiteManifestTemplate = {
  key: string
  title: string
  slots: SiteManifestSlot[]
  defaults?: Record<string, SiteManifestDefaultBlock[]>
}

export type SiteManifestDefaultBlock = {
  blockType: string
  blockVersion?: number
  data?: Record<string, unknown>
  id?: string
}

export type SiteManifestPage = {
  pageKey: string
  title: string
  path: string
  templateKey: string
  slots: SiteManifestSlot[]
  defaults?: Record<string, SiteManifestDefaultBlock[]>
}

export type SiteManifest = {
  manifestHash: string
  manifestVersion: 1
  generatedAt: string
  blocks: SiteBlocksManifest['blocks']
  templates: SiteManifestTemplate[]
  pages: SiteManifestPage[]
}

