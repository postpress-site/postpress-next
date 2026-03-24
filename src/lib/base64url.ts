export function base64urlToUint8Array(input: string): Uint8Array {
  const base64 = input.replaceAll('-', '+').replaceAll('_', '/')
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLength)

  // atob is available in the Edge/Workers runtime (and in modern Node).
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function base64urlToString(input: string): string {
  const bytes = base64urlToUint8Array(input)
  return new TextDecoder().decode(bytes)
}

