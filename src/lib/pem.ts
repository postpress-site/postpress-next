function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function normalizePem(pem: string): string {
  const trimmed = pem.trim()
  return trimmed.includes('\\n') ? trimmed.replaceAll('\\n', '\n') : trimmed
}

export function spkiPemToDer(pem: string): Uint8Array {
  const normalized = normalizePem(pem)
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean)
  const b64 = lines
    .filter((l) => !l.includes('BEGIN PUBLIC KEY') && !l.includes('END PUBLIC KEY'))
    .join('')
  return base64ToUint8Array(b64)
}
