export type BlockFieldOption = {
  label: string
  value: string
}

export type BlockFieldConfig = {
  name: string
  type: 'array' | 'checkbox' | 'json' | 'number' | 'richText' | 'select' | 'text' | 'textarea' | 'upload'
  relationTo?: string
  required?: boolean
  defaultValue?: number | string
  options?: BlockFieldOption[]
  fields?: BlockFieldConfig[]
}

export type BlockConfigForManifest = {
  slug: string
  labels?: {
    singular?: string
    plural?: string
  }
  fields: BlockFieldConfig[]
  version?: number
  category?: string
  description?: string
  defaults?: Record<string, unknown>
}

export type SiteBlocksManifest = {
  manifestHash: string
  manifestVersion: 1
  generatedAt: string
  blocks: Array<{
    slug: string
    version: number
    title: string
    description?: string
    category?: string
    defaults?: Record<string, unknown>
    fields: BlockFieldConfig[]
  }>
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function toHex(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes)
  let out = ''
  for (const b of u8) out += b.toString(16).padStart(2, '0')
  return out
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export function normalizeBlockConfigs(configs: BlockConfigForManifest[]): SiteBlocksManifest['blocks'] {
  return [...configs]
    .map((config) => ({
      slug: config.slug,
      version: config.version ?? 1,
      title: config.labels?.singular || config.slug,
      description: config.description,
      category: config.category,
      defaults: config.defaults,
      fields: config.fields,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

export async function createBlocksManifest(configs: BlockConfigForManifest[]): Promise<SiteBlocksManifest> {
  const blocks = normalizeBlockConfigs(configs)
  const manifestCore = {
    manifestVersion: 1 as const,
    blocks,
  }
  const manifestHash = await sha256Hex(stableStringify(manifestCore))
  return {
    ...manifestCore,
    manifestHash,
    generatedAt: new Date().toISOString(),
  }
}

