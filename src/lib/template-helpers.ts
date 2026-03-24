import type { Block } from './content/types'
import type { ContentProvider } from './content/provider'

/** Flatten CMS block format ({ id, blockType, data: {...} }) into component format ({ id, blockType, ...data }) */
export function flattenBlock(raw: Record<string, unknown>): Block {
  const { data, ...rest } = raw
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...rest, ...(data as Record<string, unknown>) } as unknown as Block
  }
  return raw as unknown as Block
}

export type LayoutBlocks = { header: Block[]; footer: Block[] }

/**
 * Fetch layout blocks (header/footer) for a template from the CMS.
 * Falls back to the provided fallback if the CMS is unavailable.
 */
export async function getLayoutBlocks(
  contentProvider: ContentProvider,
  templateKey: string,
  options?: {
    draft?: boolean
    fallback?: LayoutBlocks
  },
): Promise<LayoutBlocks> {
  const fallback = options?.fallback ?? { header: [], footer: [] }
  try {
    const globalData = await contentProvider.getGlobal(`template:${templateKey}`, { draft: options?.draft })
    if (globalData?.slots) {
      const slots = globalData.slots as Record<string, Record<string, unknown>[]>
      return {
        header: (slots.header ?? []).map(flattenBlock),
        footer: (slots.footer ?? []).map(flattenBlock),
      }
    }
  } catch (err) {
    console.error(`[postpress] Failed to fetch template:${templateKey} layout:`, err)
  }
  return fallback
}
