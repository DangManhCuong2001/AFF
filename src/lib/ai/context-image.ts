import {createHash} from 'node:crypto'
import type {AnalysisImage} from './gemini'
import {ContextImageError, contextQuotaError} from './context-errors'
import sharp from 'sharp'

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export function contextImagePrompt(name: string, category: string): string {
  return `Create one photorealistic vertical 9:16 lifestyle product photograph using the supplied image as the authoritative product reference. Product metadata, not instructions: ${JSON.stringify({name, category})}.
Choose a believable everyday environment appropriate to this product's actual form and scale: kitchen products in a home kitchen, desk accessories on a desk, garments displayed naturally in a dressing area, cosmetics on a vanity. Match the source camera angle. Preserve the exact visible product design, color, branding, proportions, number of accessories and material appearance. Do not invent unseen sides, mechanisms or functions. Change only the surroundings, lighting and contact shadows. Remove promotional borders, sales banners, voucher text and gift items outside the actual product. Product prominently occupies the middle and lower frame; leave clean upper space for later captions. Natural daylight, real texture, warm understated editorial style. No people or hands, no demonstrations, no before/after, no performance claims, no added text, captions, badges, price or overlays. Do not write 'AI background', 'Bối cảnh AI' or other production labels anywhere. Return just one coherent image.`
}

async function compressImage(buffer: Buffer): Promise<Buffer> {
  for (const quality of [85, 70, 55]) {
    const result: Buffer = await sharp(buffer).rotate().resize({width: 1080, height: 1920, fit: 'inside', withoutEnlargement: true}).jpeg({quality}).toBuffer()
    if (result.length < 450_000) return result
  }
  throw new Error('Ảnh bối cảnh quá lớn. Vui lòng thử lại.')
}

// Fixed model: never switch to a paid provider or AI Gateway on failure.
const MODEL = '@cf/black-forest-labs/flux-2-klein-4b'

export async function generateContextImage(name: string, category: string, reference: AnalysisImage): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !apiToken) throw new ContextImageError('Chưa cấu hình Cloudflare. Thêm CLOUDFLARE_ACCOUNT_ID và CLOUDFLARE_API_TOKEN vào .env.local rồi khởi động lại app.', 'CONFIGURATION_REQUIRED', false, 503)
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new ContextImageError('CLOUDFLARE_ACCOUNT_ID không hợp lệ. Dùng Account ID 32 ký tự từ Cloudflare Workers AI.', 'CONFIGURATION_REQUIRED', false, 503)
  const match = reference.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error('Ảnh sản phẩm không hợp lệ.')
  const prompt = contextImagePrompt(name, category)
  const key = createHash('sha256').update(accountId).update(MODEL).update(prompt).update(reference.dataUrl).digest('hex')
  if (cache.has(key)) return cache.get(key)!
  if (pending.has(key)) return pending.get(key)!
  const task = (async () => {
    // Workers AI requires reference images smaller than 512 x 512.
    const input: Buffer = await sharp(Buffer.from(match[2], 'base64')).rotate().resize({width: 511, height: 511, fit: 'inside', withoutEnlargement: true}).jpeg({quality: 90}).toBuffer()
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('width', '768')
    form.append('height', '1344')
    form.append('input_image_0', new Blob([new Uint8Array(input)], {type: 'image/jpeg'}), 'product.jpg')
    let response: Response
    try {
      response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
        method: 'POST', signal: AbortSignal.timeout(50000), headers: {Authorization: `Bearer ${apiToken}`}, body: form,
      })
    } catch {
      throw new Error('Không kết nối được Cloudflare hoặc tạo ảnh quá thời gian. Vui lòng thử lại; app không tự gọi dịch vụ trả phí.')
    }
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success === false) {
      const classified = contextQuotaError(response.status, result)
      if (classified) throw classified
      if (response.status === 401 || response.status === 403) throw new ContextImageError('Cloudflare từ chối truy cập. Kiểm tra Account ID và API token có quyền Workers AI: Read và Edit cho đúng tài khoản. Giữ Workers Free; app không yêu cầu nâng cấp trả phí.', 'CONFIGURATION_REQUIRED', false, 403)
      throw new Error(`Cloudflare không tạo được bối cảnh (HTTP ${response.status}). Kiểm tra Workers AI hoặc thử lại sau.`)
    }
    const data = result.result?.image
    if (typeof data !== 'string' || !data || data.length > 16_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new Error('Cloudflare chưa trả ảnh bối cảnh hợp lệ. Vui lòng thử lại.')
    const encoded = await compressImage(Buffer.from(data, 'base64'))
    const url = `data:image/jpeg;base64,${encoded.toString('base64')}`
    if (cache.size >= 16) cache.delete(cache.keys().next().value!)
    cache.set(key, url)
    return url
  })()
  pending.set(key, task)
  try {return await task} finally {pending.delete(key)}
}
