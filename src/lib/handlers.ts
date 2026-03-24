import { draftMode } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import type { PostpressConfig } from './config'
import { verifyPostpressJwt, type PostpressJwtClaims } from './jwt'
import { postpressTag } from './tags'

export type PostpressHandlers = {
  previewEnable: { GET: (request: NextRequest) => Promise<NextResponse> }
  previewDisable: { GET: (request: NextRequest) => Promise<NextResponse> }
  revalidate: { POST: (request: NextRequest) => Promise<NextResponse> }
  siteManifest: { GET: (request: NextRequest) => Promise<NextResponse> }
  blocksManifest: { GET: (request: NextRequest) => Promise<NextResponse> }
}

export type PostpressRouter = {
  handle: (request: NextRequest, slug: string[]) => Promise<NextResponse>
}

function authErrorResponse(message: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function readBearerToken(request: NextRequest): null | string {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const [scheme, token] = auth.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

function validateAndNormalizePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const p = value.trim()
  if (!p.startsWith('/')) return null
  return p
}

function validateTagForSite(siteId: string, tag: string): boolean {
  return tag.startsWith(`postpress:${siteId}:`)
}

async function verify(
  token: string,
  config: PostpressConfig,
  audience:
    | 'postpress_site_preview'
    | 'postpress_site_revalidate'
    | 'postpress_site_manifest'
    | 'postpress_site_blocks_manifest',
): Promise<PostpressJwtClaims> {
  return verifyPostpressJwt(token, {
    publicKeyPem: config.publicKeyPem,
    audience,
    issuer: config.issuer,
  })
}

export function createPostpressHandlers(config: PostpressConfig): PostpressHandlers {
  return {
    previewEnable: {
      async GET(request: NextRequest) {
        const token = request.nextUrl.searchParams.get('token')
        if (!token) return authErrorResponse('Missing token')

        try {
          const claims = await verify(token, config, 'postpress_site_preview')
          const path = validateAndNormalizePath(claims.path)
          if (!path) return authErrorResponse('Invalid redirect path')

          const dm = await draftMode()
          dm.enable()
          return NextResponse.redirect(new URL(path, request.nextUrl.origin))
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Invalid token'
          console.error('[DEBUG preview-enable] verification failed:', reason)
          return authErrorResponse(reason)
        }
      },
    },

    previewDisable: {
      async GET(request: NextRequest) {
        const dm = await draftMode()
        dm.disable()
        return NextResponse.redirect(new URL('/', request.nextUrl.origin))
      },
    },

    revalidate: {
      async POST(request: NextRequest) {
        const token = readBearerToken(request)
        if (!token) return authErrorResponse('Missing bearer token')

        let claims: PostpressJwtClaims
        try {
          claims = await verify(token, config, 'postpress_site_revalidate')
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unauthorized'
          return authErrorResponse(reason)
        }

        const pageKeys = Array.isArray(claims.pageKeys) ? claims.pageKeys : []
        const tags = Array.isArray(claims.tags) ? claims.tags : []
        const paths = Array.isArray(claims.paths) ? claims.paths : []

        if (pageKeys.length === 0 && tags.length === 0 && paths.length === 0) {
          return NextResponse.json({ error: 'Missing pageKeys/tags/paths' }, { status: 400 })
        }

        const revalidated: { pageKeys: string[]; tags: string[]; paths: string[] } = {
          pageKeys: [],
          tags: [],
          paths: [],
        }

        for (const pageKey of pageKeys) {
          const tag = postpressTag.pageKey(config.siteId, pageKey)
          ;(revalidateTag as (...args: unknown[]) => void)(tag)
          revalidated.pageKeys.push(pageKey)
          revalidated.tags.push(tag)
        }

        for (const tag of tags) {
          if (!validateTagForSite(config.siteId, tag)) continue
          ;(revalidateTag as (...args: unknown[]) => void)(tag)
          revalidated.tags.push(tag)
        }

        for (const p of paths) {
          const path = validateAndNormalizePath(p)
          if (!path) continue
          revalidatePath(path)
          revalidated.paths.push(path)
        }

        return NextResponse.json({
          ok: true,
          ...revalidated,
          timestamp: Date.now(),
        })
      },
    },

    siteManifest: {
      async GET(request: NextRequest) {
        const token = readBearerToken(request)
        if (!token) return authErrorResponse('Missing bearer token')
        try {
          await verify(token, config, 'postpress_site_manifest')
          const manifest = await config.buildSiteManifest()
          return NextResponse.json(manifest)
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unauthorized'
          return authErrorResponse(reason)
        }
      },
    },

    blocksManifest: {
      async GET(request: NextRequest) {
        const token = readBearerToken(request)
        if (!token) return authErrorResponse('Missing bearer token')
        try {
          await verify(token, config, 'postpress_site_blocks_manifest')
          const manifest = await config.buildBlocksManifest()
          return NextResponse.json(manifest)
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unauthorized'
          return authErrorResponse(reason)
        }
      },
    },
  }
}

export function createPostpressRouter(config: PostpressConfig): PostpressRouter {
  const handlers = createPostpressHandlers(config)

  return {
    async handle(request: NextRequest, slug: string[]) {
      const route = slug.join('/')
      const method = request.method.toUpperCase()

      if (route === 'preview/enable' && method === 'GET') return handlers.previewEnable.GET(request)
      if (route === 'preview/disable' && method === 'GET') return handlers.previewDisable.GET(request)
      if (route === 'revalidate' && method === 'POST') return handlers.revalidate.POST(request)
      if (route === 'site-manifest' && method === 'GET') return handlers.siteManifest.GET(request)
      if (route === 'blocks-manifest' && method === 'GET') return handlers.blocksManifest.GET(request)

      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    },
  }
}
