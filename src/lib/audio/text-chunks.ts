/** Prefer sentence/clause boundaries; split at words only when a clause is too long. */
export function splitTTSText(text: string, limit = 150): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  while (words.length) {
    let size = 0, end = 0, boundary = 0
    for (; end < words.length; end++) {
      const next = size + (end ? 1 : 0) + words[end].length
      if (next > limit && end) break
      size = next
      if (/[.!?;:,]$/.test(words[end]) && !/\d[.,]\d/.test(words[end])) boundary = end + 1
    }
    const count = end < words.length && boundary ? boundary : Math.max(1, end)
    chunks.push(words.splice(0, count).join(' '))
  }
  return chunks
}
