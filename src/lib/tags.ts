function normalizeSiteId(siteId: string): string {
  const trimmed = siteId.trim()
  if (!trimmed) throw new Error('siteId is required')
  return trimmed
}

export const postpressTag = {
  pageKey(siteId: string, pageKey: string): string {
    const sid = normalizeSiteId(siteId)
    const key = pageKey.trim()
    if (!key) throw new Error('pageKey is required')
    return `postpress:${sid}:pageKey:${key}`
  },

  global(siteId: string, name: string): string {
    const sid = normalizeSiteId(siteId)
    const n = name.trim()
    if (!n) throw new Error('name is required')
    return `postpress:${sid}:${n}`
  },

  post(siteId: string, slugOrId: string): string {
    const sid = normalizeSiteId(siteId)
    const v = slugOrId.trim()
    if (!v) throw new Error('slugOrId is required')
    return `postpress:${sid}:post:${v}`
  },

  listing(siteId: string, name: string): string {
    const sid = normalizeSiteId(siteId)
    const n = name.trim()
    if (!n) throw new Error('name is required')
    return `postpress:${sid}:listing:${n}`
  },
}

