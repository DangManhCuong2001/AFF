import sharp from 'sharp'
import {isAllowedProductImageUrl} from './remote-image-url'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** Recover imported CDN photos when the browser cannot read them because of CORS. */
export async function loadRemoteAnalysisImage(url: string): Promise<Buffer> {
  if (!isAllowedProductImageUrl(url)) throw new Error('Nguồn ảnh không được hỗ trợ. Hãy tải ảnh sản phẩm từ máy.')
  const response = await fetch(url, {signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store'})
  if (!response.ok || !/^image\/(jpeg|png|webp|avif)(?:;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('Không tải được ảnh sản phẩm từ nguồn này.')
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
    await response.body?.cancel()
    throw new Error('Ảnh sản phẩm quá lớn.')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Nguồn không trả dữ liệu ảnh.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE_BYTES) throw new Error('Ảnh sản phẩm quá lớn.')
      chunks.push(value)
    }
  } finally {await reader.cancel()}
  return sharp(Buffer.concat(chunks), {limitInputPixels: 40_000_000}).rotate()
    .resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true})
    .flatten({background: '#ffffff'}).jpeg({quality: 80}).toBuffer()
}
