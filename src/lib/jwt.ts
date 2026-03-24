import { base64urlToString, base64urlToUint8Array } from './base64url'
import { spkiPemToDer } from './pem'

export type PostpressJwtClaims = {
  aud: string
  exp: number
  iat?: number
  iss?: string
  path?: string
  orgId?: string
  pageKeys?: string[]
  tags?: string[]
  paths?: string[]
  [key: string]: unknown
}

async function importEd25519PublicKeyFromSpkiPem(publicKeyPem: string): Promise<CryptoKey> {
  const der = spkiPemToDer(publicKeyPem)
  const spki = Uint8Array.from(der)
  return crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify'])
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') return null
    const v = entry.trim()
    if (!v) continue
    out.push(v)
  }
  return out
}

export async function verifyPostpressJwt(
  token: string,
  input: { publicKeyPem: string; audience: string; issuer?: string | string[] },
): Promise<PostpressJwtClaims> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT shape')
  const [encodedHeader, encodedPayload, encodedSig] = parts
  if (!encodedHeader || !encodedPayload || !encodedSig) throw new Error('Invalid JWT shape')

  const headerJson = base64urlToString(encodedHeader)
  const header = JSON.parse(headerJson) as { alg?: string; typ?: string }
  if (header.alg !== 'EdDSA') throw new Error('Unsupported alg')

  const payloadJson = base64urlToString(encodedPayload)
  const claims = JSON.parse(payloadJson) as PostpressJwtClaims

  if (claims.aud !== input.audience) throw new Error('Invalid audience')
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds()) throw new Error('Expired token')
  if (input.issuer) {
    const allowed = Array.isArray(input.issuer) ? input.issuer : [input.issuer]
    if (!claims.iss || !allowed.includes(claims.iss)) throw new Error('Invalid issuer')
  }

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const signature = Uint8Array.from(base64urlToUint8Array(encodedSig))
  const data = Uint8Array.from(signingInput)
  const publicKey = await importEd25519PublicKeyFromSpkiPem(input.publicKeyPem)
  const ok = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, signature, data)
  if (!ok) throw new Error('Invalid signature')

  // Normalize arrays if present.
  const pageKeys = asStringArray(claims.pageKeys)
  if (pageKeys) claims.pageKeys = pageKeys
  const tags = asStringArray(claims.tags)
  if (tags) claims.tags = tags
  const paths = asStringArray(claims.paths)
  if (paths) claims.paths = paths

  return claims
}
