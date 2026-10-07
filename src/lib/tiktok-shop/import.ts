import { ProductInput, ProductAsset } from '@/engines/core/types'

export interface TikTokShopImportResult {
  success: boolean
  message: string
  product?: Partial<ProductInput>
  requiresManualFallback: boolean
  extractedId?: string
}

export interface ExtractedUrlMetadata {
  title?: string
  imageUrl?: string
  productId?: string
}

/**
 * Checks if a title is invalid, empty, or generic non-product response
 */
export function isInvalidOrGenericTitle(title: string): boolean {
  if (!title) return true
  const lower = title.toLowerCase().trim()

  if (
    lower.includes('security check') ||
    lower.includes('captcha') ||
    lower.includes('robot check') ||
    lower.includes('just a moment') ||
    lower.includes('access denied') ||
    lower.includes('verify to continue') ||
    lower.includes('attention required') ||
    lower.includes('cloudflare') ||
    lower === 'tiktok' ||
    lower.startsWith('tiktok shop') ||
    lower.includes('tiktok shop vietnam') ||
    lower.includes('tiktok shop vn') ||
    lower.endsWith('tiktok shop') ||
    lower === 'tiktok - make your day' ||
    lower === 'visit tiktok to discover videos!' ||
    lower === 'không tìm thấy trang' ||
    lower === 'page not found'
  ) {
    return true
  }

  return false
}

/**
 * Checks if HTML is a bot challenge
 */
export function isAntiBotHtml(html: string = ''): boolean {
  if (!html) return false
  const lowerHtml = html.toLowerCase()

  return (
    lowerHtml.includes('captcha/index.js') ||
    lowerHtml.includes('oec-ttweb-captcha') ||
    lowerHtml.includes('bric-captcha') ||
    lowerHtml.includes('middle_page_loading')
  )
}

/**
 * Legacy compatibility helper
 */
export function isAntiBotOrGeneric(title: string, html: string = ''): boolean {
  return isInvalidOrGenericTitle(title) || isAntiBotHtml(html)
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
 * Extract clean URL and potential title hint from text copied from TikTok app share
 * (e.g. "Mua Tai nghe bluetooth tại TikTok Shop: https://vt.tiktok.com/ZS.../")
 */
export function extractUrlAndTitleHint(rawInput: string): { url: string; titleHint: string } {
  const cleaned = rawInput.trim()
  const urlMatch = cleaned.match(/https?:\/\/[^\s"'<>]+/i)

  if (urlMatch) {
    const rawUrl = urlMatch[0].replace(/[),.;!]+$/, '')
    const targetUrl = cleanProductUrl(rawUrl)

    // Extract text hint from surrounding share text
    const textHint = cleaned
      .replace(urlMatch[0], '')
      .replace(/^(Xem|Mua|Đặt mua|Tham khảo|Check|Link)\s+/i, '')
      .replace(/(tại|trên)?\s*TikTok Shop.*$/i, '')
      .replace(/[:!?,]/g, '')
      .trim()

    return {
      url: targetUrl,
      titleHint: isAntiBotOrGeneric(textHint) ? '' : textHint,
    }
  }

  return {
    url: cleanProductUrl(cleaned),
    titleHint: '',
  }
}

/**
 * Extract Product ID from official TikTok Shop URLs
 */
export function extractTikTokShopProductId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim())

    // Direct /product/:id or /pdp/:id path
    const productMatch = url.pathname.match(/\/(?:product|pdp)\/(?:[a-zA-Z0-9_\-]+-)?(\d+)/i)
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
 * Extract rich metadata embedded in URL parameters (e.g. TikTok og_info JSON, query params, slug)
 */
export function extractMetadataFromUrl(urlStr: string): ExtractedUrlMetadata {
  try {
    const parsed = new URL(urlStr)
    let title: string | undefined
    let imageUrl: string | undefined

    // 1. Check og_info param (TikTok Shop standard share payload containing {title, image})
    if (parsed.searchParams.has('og_info')) {
      try {
        const rawOg = parsed.searchParams.get('og_info')
        if (rawOg) {
          const parsedOg = JSON.parse(rawOg)
          if (parsedOg.title && typeof parsedOg.title === 'string' && !isAntiBotOrGeneric(parsedOg.title)) {
            title = parsedOg.title.trim()
          }
          if (parsedOg.image && typeof parsedOg.image === 'string' && parsedOg.image.startsWith('http')) {
            imageUrl = parsedOg.image.trim()
          }
        }
      } catch {}
    }

    // 2. Check title / name params
    if (!title) {
      for (const key of ['title', 'product_title', 'name', 'product_name']) {
        if (parsed.searchParams.has(key)) {
          const val = parsed.searchParams.get(key)
          if (val && val.length > 3 && !isAntiBotOrGeneric(val)) {
            title = val.trim()
            break
          }
        }
      }
    }

    // 3. Check image params
    if (!imageUrl) {
      for (const key of ['image', 'cover', 'product_image', 'img']) {
        if (parsed.searchParams.has(key)) {
          const val = parsed.searchParams.get(key)
          if (val && val.startsWith('http')) {
            imageUrl = val.trim()
            break
          }
        }
      }
    }

    // 4. Slug in path: /vn/pdp/sac-nhanh-20w-1729424888888 or /product/tai-nghe-123
    if (!title) {
      const slugMatch = parsed.pathname.match(/\/(?:pdp|product)\/([a-zA-Z0-9_\-]+?)(?:-(\d{8,}))?$/)
      if (slugMatch && slugMatch[1] && !/^\d+$/.test(slugMatch[1])) {
        const words = slugMatch[1].replace(/[-_]+/g, ' ').trim()
        if (words.length > 3 && !isAntiBotOrGeneric(words)) {
          title = words.charAt(0).toUpperCase() + words.slice(1)
        }
      }
    }

    const productId = extractTikTokShopProductId(urlStr)

    return { title, imageUrl, productId: productId || undefined }
  } catch {
    return {}
  }
}

/**
 * Imports Product Information directly from TikTok Shop link
 * by reading public OpenGraph metadata, URL embedded metadata (og_info), JSON-LD, and SSR product details,
 * with anti-bot challenge protection.
 */
export async function importTikTokShopProduct(rawInput: string): Promise<TikTokShopImportResult> {
  const { url: targetUrl, titleHint } = extractUrlAndTitleHint(rawInput)

  if (!targetUrl) {
    return {
      success: false,
      message: 'Vui lòng dán đường link sản phẩm TikTok Shop hợp lệ.',
      requiresManualFallback: false,
    }
  }

  // Pre-parse metadata directly from input URL (e.g. og_info, slug, title params)
  const targetMeta = extractMetadataFromUrl(targetUrl)
  let productId = targetMeta.productId || extractTikTokShopProductId(targetUrl)

  try {
    // Strategy 1: Desktop Browser headers
    const browserHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }

    let res = await fetch(targetUrl, {
      headers: browserHeaders,
      redirect: 'follow',
    })

    let finalUrl = res.url || targetUrl
    const finalMeta = extractMetadataFromUrl(finalUrl)

    if (!productId) {
      productId = finalMeta.productId || extractTikTokShopProductId(finalUrl)
    }

    let html = await res.text()

    // 1. Check title from HTML
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = (ogTitleMatch?.[1] || titleTagMatch?.[1] || '').trim()

    title = title
      .replace(/\s*-\s*TikTok Shop.*$/i, '')
      .replace(/\s*\|\s*TikTok Shop.*$/i, '')
      .trim()

    // If Strategy 1 hits Anti-bot "Security Check" or generic page, try Strategy 2 (Social Media Crawler)
    if (isAntiBotOrGeneric(title, html)) {
      try {
        const crawlerRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        })
        if (crawlerRes.ok) {
          const crawlerHtml = await crawlerRes.text()
          const crawlerTitleMatch = crawlerHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
          const altTitle = (crawlerTitleMatch?.[1] || '').replace(/\s*-\s*TikTok Shop.*$/i, '').trim()
          if (altTitle && !isAntiBotOrGeneric(altTitle, crawlerHtml)) {
            title = altTitle
            html = crawlerHtml
            finalUrl = crawlerRes.url || finalUrl
          }
        }
      } catch {
        // Fallback silently if crawler request fails
      }
    }

    // 2. Try JSON-LD extraction
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    let jsonLdTitle = ''
    let jsonLdPrice: number | undefined
    let jsonLdImage = ''

    for (const match of jsonLdMatches) {
      try {
        const ldData = JSON.parse(match[1])
        if (ldData && (ldData['@type'] === 'Product' || ldData.name)) {
          if (typeof ldData.name === 'string' && !isAntiBotOrGeneric(ldData.name)) {
            jsonLdTitle = ldData.name
          }
          if (ldData.offers?.price) {
            const p = parseInt(String(ldData.offers.price).replace(/[^\d]/g, ''), 10)
            if (!isNaN(p) && p > 0) jsonLdPrice = p
          }
          if (typeof ldData.image === 'string') {
            jsonLdImage = ldData.image
          } else if (Array.isArray(ldData.image) && typeof ldData.image[0] === 'string') {
            jsonLdImage = ldData.image[0]
          }
        }
      } catch {}
    }

    if (jsonLdTitle && isAntiBotOrGeneric(title)) {
      title = jsonLdTitle
    }

    // 3. Resolve best metadata from URL params (og_info, slug, share hint)
    const bestUrlTitle = finalMeta.title || targetMeta.title || titleHint
    const bestUrlImage = finalMeta.imageUrl || targetMeta.imageUrl

    // If HTML was blocked by Security Check / Captcha or title is invalid, check if URL contains og_info or valid title:
    if (isInvalidOrGenericTitle(title) || isAntiBotHtml(html)) {
      if (bestUrlTitle && !isInvalidOrGenericTitle(bestUrlTitle)) {
        title = bestUrlTitle
      }
    }

    // If title is STILL Security Check, Captcha, or generic TikTok Shop, reject as automated bot challenge
    if (isInvalidOrGenericTitle(title)) {
      return {
        success: false,
        message:
          'TikTok Shop đang bật bảo mật chống bot (Security Check). Link sản phẩm đã được lưu, vui lòng nhập Tên sản phẩm và chọn ảnh ở bên dưới nhé!',
        requiresManualFallback: true,
        extractedId: productId || undefined,
        product: {
          name: bestUrlTitle && !isInvalidOrGenericTitle(bestUrlTitle) ? bestUrlTitle : undefined,
          productUrl: finalUrl || targetUrl,
          shopProductId: productId || undefined,
          assets: [],
        },
      }
    }

    // 4. Extract Gallery Images
    const assets: ProductAsset[] = []
    const seenHashes = new Set<string>()

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
    let primaryImageUrl = bestUrlImage || jsonLdImage || ogImageMatch?.[1] || ''

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

    // Extract secondary gallery images from page HTML
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

    // 5. Extract Description
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    const description = ogDescMatch?.[1] || ''

    // 6. Extract Price
    let price: number | undefined = jsonLdPrice
    if (!price) {
      const realPriceMatch = html.match(/"real_price":"([^"]+)"/)
      const formatPriceMatch = html.match(/"(?:format_price|sale_price|price)":"?([^",}]+)"?/)

      if (realPriceMatch && realPriceMatch[1]) {
        const numStr = realPriceMatch[1].replace(/[^\d]/g, '')
        if (numStr) price = parseInt(numStr, 10)
      } else if (formatPriceMatch && formatPriceMatch[1]) {
        const numStr = formatPriceMatch[1].replace(/[^\d]/g, '')
        if (numStr) price = parseInt(numStr, 10)
      }
    }

    return {
      success: true,
      message: `Đã trích xuất thành công: ${title}`,
      requiresManualFallback: false,
      extractedId: productId || undefined,
      product: {
        name: title,
        price: price || '',
        description: description || `Sản phẩm ${title} trên TikTok Shop`,
        productUrl: finalUrl || targetUrl,
        shopProductId: productId || undefined,
        assets,
      },
    }
  } catch (err: unknown) {
    console.warn('[TikTokShopImport] Public HTML extract failed:', (err as Error).message)

    // Fallback: Check if metadata can be recovered directly from URL params
    const fallbackMeta = extractMetadataFromUrl(targetUrl)
    const fallbackTitle = fallbackMeta.title || titleHint
    const fallbackImage = fallbackMeta.imageUrl

    if (fallbackTitle) {
      const assets: ProductAsset[] = []
      if (fallbackImage) {
        assets.push({
          id: 'asset-imported-' + Date.now() + '-0',
          name: `${fallbackTitle} (Ảnh chính).jpg`,
          type: 'PRODUCT_IMAGE',
          url: fallbackImage,
          size: 0,
          isPrimary: true,
        })
      }

      return {
        success: true,
        message: `Đã trích xuất thành công: ${fallbackTitle}`,
        requiresManualFallback: false,
        extractedId: productId || undefined,
        product: {
          name: fallbackTitle,
          price: '',
          description: `Sản phẩm ${fallbackTitle} trên TikTok Shop`,
          productUrl: targetUrl,
          shopProductId: productId || undefined,
          assets,
        },
      }
    }

    return {
      success: false,
      message:
        'Không thể tự động tải thông tin từ link này (yêu cầu xác minh TikTok hoặc hết hạn). Link đã được lưu, vui lòng nhập Tên sản phẩm và chọn ảnh ở mục bên dưới nhé!',
      requiresManualFallback: true,
      extractedId: productId || undefined,
      product: {
        name: fallbackTitle || undefined,
        productUrl: targetUrl,
        shopProductId: productId || undefined,
      },
    }
  }
}
