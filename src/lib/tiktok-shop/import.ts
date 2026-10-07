import { ProductInput, ProductAsset } from '@/engines/core/types'

export interface TikTokShopImportResult {
  success: boolean
  message: string
  product?: Partial<ProductInput>
  requiresManualFallback: boolean
  extractedId?: string
}

/**
 * Clean URL and unpack Zalo/redirect wrappers if present
 */
export function cleanProductUrl(rawInput: string): string {
  let cleaned = rawInput.trim()
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned
  }

  try {
    const parsed = new URL(cleaned)
    // Unwrap Zalo redirect or similar wrappers
    if (parsed.searchParams.has('continue')) {
      const target = parsed.searchParams.get('continue')
      if (target) return decodeURIComponent(target)
    }
    if (parsed.searchParams.has('url')) {
      const target = parsed.searchParams.get('url')
      if (target) return decodeURIComponent(target)
    }
  } catch {
    // Return original if parsing fails
  }

  return cleaned
}

/**
 * Extract Product ID from official TikTok Shop URLs
 */
export function extractTikTokShopProductId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim())

    // Direct /product/:id or /pdp/:id path
    const productMatch = url.pathname.match(/\/(?:product|pdp)\/(\d+)/i)
    if (productMatch && productMatch[1]) {
      return productMatch[1]
    }

    // Query param ?product_id=:id
    const queryId = url.searchParams.get('product_id') || url.searchParams.get('item_id')
    if (queryId && /^\d+$/.test(queryId)) {
      return queryId
    }

    return null
  } catch {
    return null
  }
}

/**
 * Imports Product Information directly from TikTok Shop link
 * by reading public OpenGraph metadata and Server-Side Rendered (SSR) product details.
 */
export async function importTikTokShopProduct(rawUrl: string): Promise<TikTokShopImportResult> {
  const targetUrl = cleanProductUrl(rawUrl)
  if (!targetUrl) {
    return {
      success: false,
      message: 'Vui lòng dán đường link sản phẩm TikTok Shop hợp lệ.',
      requiresManualFallback: false,
    }
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const html = await res.text()
    const productId = extractTikTokShopProductId(res.url) || extractTikTokShopProductId(targetUrl)

    // 1. Extract Product Title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = ogTitleMatch?.[1] || titleTagMatch?.[1] || ''

    // Clean title suffix if present
    title = title
      .replace(/\s*-\s*TikTok Shop.*$/i, '')
      .replace(/\s*\|\s*TikTok Shop.*$/i, '')
      .trim()

    // 2. Extract ALL Product Images from Gallery
    const assets: ProductAsset[] = []
    const seenHashes = new Set<string>()

    // Check og:image first
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
    let primaryImageUrl = ogImageMatch?.[1] || ''
    if (primaryImageUrl) {
      primaryImageUrl = primaryImageUrl.replace(/&amp;/g, '&')
      const hashMatch = primaryImageUrl.match(/tos-maliva[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/)
      if (hashMatch) seenHashes.add(hashMatch[1])

      assets.push({
        id: 'asset-imported-' + Date.now() + '-0',
        name: `${title || 'Sản phẩm'} (Ảnh chính).jpg`,
        type: 'PRODUCT_IMAGE',
        url: primaryImageUrl,
        size: 0,
        isPrimary: true,
      })
    }

    // Extract all secondary gallery images from page HTML
    const imgRegex = /https:\/\/[^"'<>\s]+\/tos-maliva-[^"'<>\s]+(?:800:800|\.jpeg|\.webp)[^"'<>\s]*/gi
    const rawMatches = html.match(imgRegex) || []

    for (const m of rawMatches) {
      const hashMatch = m.match(/tos-maliva[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/)
      if (hashMatch) {
        const hash = hashMatch[1]
        if (!seenHashes.has(hash) && assets.length < 8) {
          seenHashes.add(hash)
          const highResUrl = `https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/${hash}~tplv-o3syd03w52-resize-jpeg:800:800.jpeg`
          assets.push({
            id: 'asset-imported-' + Date.now() + '-' + assets.length,
            name: `${title || 'Sản phẩm'} (Góc ${assets.length + 1}).jpg`,
            type: 'DETAIL_IMAGE',
            url: highResUrl,
            size: 0,
            isPrimary: assets.length === 0,
          })
        }
      }
    }

    // 3. Extract Description
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    const description = ogDescMatch?.[1] || ''

    // 4. Extract Price from SSR JSON
    let price: number | undefined
    const realPriceMatch = html.match(/"real_price":"([^"]+)"/)
    const formatPriceMatch = html.match(/"(?:format_price|sale_price|price)":"?([^",}]+)"?/)

    if (realPriceMatch && realPriceMatch[1]) {
      const numStr = realPriceMatch[1].replace(/[^\d]/g, '')
      if (numStr) price = parseInt(numStr, 10)
    } else if (formatPriceMatch && formatPriceMatch[1]) {
      const numStr = formatPriceMatch[1].replace(/[^\d]/g, '')
      if (numStr) price = parseInt(numStr, 10)
    }

    if (title && title.length > 2) {
      return {
        success: true,
        message: `Đã trích xuất thành công: ${title}`,
        requiresManualFallback: false,
        extractedId: productId || undefined,
        product: {
          name: title,
          price: price || '',
          description: description || `Sản phẩm ${title} trên TikTok Shop`,
          productUrl: targetUrl,
          shopProductId: productId || undefined,
          assets,
        },
      }
    }

    // If title was not found via regex
    throw new Error('Không tìm thấy thông tin sản phẩm trong trang')
  } catch (err: unknown) {
    console.warn('[TikTokShopImport] Public HTML extract failed:', (err as Error).message)

    return {
      success: false,
      message:
        'Không thể tự động tải thông tin từ link này (link có thể đã hết hạn hoặc yêu cầu đăng nhập TikTok). Vui lòng nhập tên và tải ảnh ở mục bên dưới nhé!',
      requiresManualFallback: true,
      product: {
        productUrl: targetUrl,
      },
    }
  }
}
