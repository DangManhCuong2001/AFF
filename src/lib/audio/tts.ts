import https from 'https'

/**
 * Generates Vietnamese neural/standard speech audio buffer (MP3) from text.
 * Uses low-latency Google TTS service (reliable, fast, no API key required).
 */
export async function generateVietnameseTTS(text: string): Promise<Buffer> {
  const cleanText = text.trim().slice(0, 200) // Keep within reasonable single-utterance limit
  if (!cleanText) {
    throw new Error('Text is required for TTS generation')
  }

  const encoded = encodeURIComponent(cleanText)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`

  return new Promise<Buffer>((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`TTS service returned HTTP ${res.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', (err) => reject(err))
  })
}
