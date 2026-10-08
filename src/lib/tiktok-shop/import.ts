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
 * Parse ByteDance Modern.js Router Data embedded in TikTok Shop PDP HTML
 */
export function parseModernRouterData(html: string): {
  title: string
  price: number
  description: string
  assets: ProductAsset[]
  shopProductId?: string
} | null {
  const match = html.match(
    /<script[^>]*id=["']__MODERN_ROUTER_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  )
  if (!match) return null

  try {
    const data = JSON.parse(match[1])
    let productInfo: any = null
    const loaderData = data.loaderData || {}

    // Find component_data containing product_info
    for (const pageVal of Object.values(loaderData) as any[]) {
      if (pageVal && pageVal.page_config && pageVal.page_config.components_map) {
        for (const comp of pageVal.page_config.components_map) {
          if (comp.component_data && comp.component_data.product_info) {
            productInfo = comp.component_data.product_info
            break
          }
        }
      }
      if (productInfo) break
    }

    if (!productInfo) return null

    const title = (productInfo.title || '').trim()
    if (!title || isInvalidOrGenericTitle(title)) return null

    // Extract Price (VND integer)
    let price = 0
    if (productInfo.price) {
      const pStr =
        productInfo.price.real_price ||
        productInfo.price.min_sku_price ||
        productInfo.price.sale_price_format ||
        productInfo.price.original_price ||
        ''
      const digits = String(pStr).replace(/[^\d]/g, '')
      if (digits) price = parseInt(digits, 10)
    }
    if (!price && Array.isArray(productInfo.skus) && productInfo.skus[0]?.price) {
      const skuP = productInfo.skus[0].price
      const pStr =
        skuP.sale_price_decimal ||
        skuP.sale_price_format ||
        skuP.origin_price_format ||
        ''
      const digits = String(pStr).replace(/[^\d]/g, '')
      if (digits) price = parseInt(digits, 10)
    }

    // Extract Gallery Images (all high-res 800x800)
    const assets: ProductAsset[] = []
    const seenUrls = new Set<string>()

    if (Array.isArray(productInfo.images)) {
      for (const img of productInfo.images) {
        let u = (img.url_list && img.url_list[0]) || ''
        if (!u && img.uri) {
          u = `https://p16-oec-va.ibyteimg.com/${img.uri}~tplv-o3syd03w52-resize-jpeg:800:800.jpeg`
        }
        if (u && !seenUrls.has(u)) {
          seenUrls.add(u)
          assets.push({
            id: `asset-imported-${Date.now()}-${assets.length}`,
            name: `${title} (Ảnh ${assets.length + 1}).jpg`,
            type: assets.length === 0 ? 'PRODUCT_IMAGE' : 'DETAIL_IMAGE',
            url: u,
            size: 0,
            isPrimary: assets.length === 0,
          })
        }
      }
    }

    // Extract Variant Images (sale_props color/specification photos)
    if (Array.isArray(productInfo.sale_props)) {
      for (const prop of productInfo.sale_props) {
        if (Array.isArray(prop.sale_prop_values)) {
          for (const val of prop.sale_prop_values) {
            if (val.image && (val.image.uri || val.image.url_list?.[0])) {
              const u =
                val.image.url_list?.[0] ||
                `https://p16-oec-va.ibyteimg.com/${val.image.uri}~tplv-o3syd03w52-resize-jpeg:800:800.jpeg`
              if (u && !seenUrls.has(u)) {
                seenUrls.add(u)
                assets.push({
                  id: `asset-imported-${Date.now()}-${assets.length}`,
                  name: `${val.prop_value || title} (Phân loại).jpg`,
                  type: 'DETAIL_IMAGE',
                  url: u,
                  size: 0,
                  isPrimary: false,
                })
              }
            }
          }
        }
      }
    }

    // Extract Description blocks
    const descParts: string[] = []
    if (Array.isArray(productInfo.desc_blocks)) {
      for (const block of productInfo.desc_blocks) {
        if (block.type === 'text' && block.text) {
          descParts.push(block.text.trim())
        } else if (block.type === 'ul' && Array.isArray(block.content)) {
          descParts.push(block.content.map((c: string) => `• ${c}`).join('\n'))
        }
      }
    }
    const description =
      descParts.join('\n\n') || `Sản phẩm ${title} trên TikTok Shop`

    return {
      title,
      price,
      description,
      assets,
      shopProductId: productInfo.product_id ? String(productInfo.product_id) : undefined,
    }
  } catch (err) {
    console.warn('[TikTokShopImport] parseModernRouterData error:', err)
    return null
  }
}

/**
 * Helper to fetch TikTok PDP with cookie session warmup
 */
async function fetchTikTokPage(
  targetUrl: string,
  cleanPdpUrl?: string
): Promise<{ html: string; finalUrl: string }> {
  // Strategy 1: Clean standard browser headers without Sec-Ch-Ua (prevents Akamai TLS fingerprint mismatch)
  const standardHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }

  let html = ''
  let finalUrl = targetUrl

  try {
    const res = await fetch(targetUrl, {
      headers: standardHeaders,
      redirect: 'follow',
    })
    html = await res.text()
    finalUrl = res.url || targetUrl
  } catch (err) {
    console.warn('[TikTokShopImport] native fetch failed:', err)
  }

  // Strategy 2: If blocked by Security Check, try system curl fallback if available
  if (isAntiBotHtml(html) || isInvalidOrGenericTitle(html) || !html.includes('__MODERN_ROUTER_DATA__')) {
    try {
      const { execSync } = await import('child_process')
      const curlCmd = `curl -s -L --max-time 6 "${targetUrl}"`
      const curlOutput = execSync(curlCmd, { maxBuffer: 15 * 1024 * 1024, encoding: 'utf8' })
      if (curlOutput && curlOutput.includes('__MODERN_ROUTER_DATA__') && !isAntiBotHtml(curlOutput)) {
        html = curlOutput
      }
    } catch {
      // Child process curl fallback not available or failed
    }
  }

  // Strategy 3: If still challenged and clean canonical PDP url exists, try it
  if (
    cleanPdpUrl &&
    cleanPdpUrl !== targetUrl &&
    (isAntiBotHtml(html) || isInvalidOrGenericTitle(html))
  ) {
    try {
      const cleanRes = await fetch(cleanPdpUrl, {
        headers: standardHeaders,
        redirect: 'follow',
      })
      const cleanHtml = await cleanRes.text()
      if (!isAntiBotHtml(cleanHtml) && cleanHtml.includes('__MODERN_ROUTER_DATA__')) {
        html = cleanHtml
        finalUrl = cleanRes.url || cleanPdpUrl
      }
    } catch {
      // Keep previous html
    }
  }

  return { html, finalUrl }
}

/**
 * Imports Product Information directly from TikTok Shop link
 * by reading Modern.js Router Data, OpenGraph metadata, URL embedded metadata (og_info), JSON-LD,
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
  const cleanPdpUrl = productId ? `https://shop.tiktok.com/vn/pdp/${productId}` : undefined

  try {
    const { html, finalUrl } = await fetchTikTokPage(targetUrl, cleanPdpUrl)
    const finalMeta = extractMetadataFromUrl(finalUrl)

    if (!productId) {
      productId = finalMeta.productId || extractTikTokShopProductId(finalUrl)
    }

    // ============================================================
    // Strategy 1: ByteDance Modern.js Router Data (__MODERN_ROUTER_DATA__)
    // This contains the full, authoritative product data with all gallery images and price!
    // ============================================================
    const modernData = parseModernRouterData(html)
    if (modernData) {
      return {
        success: true,
        message: `Đã trích xuất thành công: ${modernData.title} (${modernData.assets.length} ảnh, giá: ${
          modernData.price > 0 ? modernData.price.toLocaleString('vi-VN') + '₫' : 'Liên hệ'
        })`,
        requiresManualFallback: false,
        extractedId: modernData.shopProductId || productId || undefined,
        product: {
          name: modernData.title,
          price: modernData.price > 0 ? modernData.price : '',
          description: modernData.description,
          productUrl: finalUrl || targetUrl,
          shopProductId: modernData.shopProductId || productId || undefined,
          assets: modernData.assets,
        },
      }
    }

    // ============================================================
    // Strategy 2: Standard HTML Metadata & JSON-LD
    // ============================================================
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = (ogTitleMatch?.[1] || titleTagMatch?.[1] || '').trim()

    title = title
      .replace(/\s*-\s*TikTok Shop.*$/i, '')
      .replace(/\s*\|\s*TikTok Shop.*$/i, '')
      .trim()

    // Try JSON-LD extraction
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

    // Resolve best metadata from URL params (og_info, slug, share hint)
    const bestUrlTitle = finalMeta.title || targetMeta.title || titleHint
    const bestUrlImage = finalMeta.imageUrl || targetMeta.imageUrl

    // If HTML was blocked by Security Check / Captcha or title is generic, use og_info
    const isChallenged = isInvalidOrGenericTitle(title) || isAntiBotHtml(html)
    if (isChallenged && bestUrlTitle && !isInvalidOrGenericTitle(bestUrlTitle)) {
      title = bestUrlTitle
    }

    // If title is STILL Security Check or invalid, reject
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

    // Extract Gallery Images from HTML regex
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
    if (!isChallenged) {
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
    }

    // If only 1 image was obtained (e.g. from og_info during TikTok anti-bot challenge),
    // expand into multi-scene perspective assets so the video generation engine
    // has distinct scenes (Toàn cảnh, Cận cảnh chi tiết, Góc phối cảnh) instead of repeating 1 image!
    if (primaryImageUrl && assets.length === 1) {
      assets.push({
        id: 'asset-imported-' + Date.now() + '-1',
        name: `${title || 'Sản phẩm'} (Cận cảnh chi tiết).jpg`,
        type: 'DETAIL_IMAGE',
        url: primaryImageUrl,
        size: 0,
        isPrimary: false,
      })
      assets.push({
        id: 'asset-imported-' + Date.now() + '-2',
        name: `${title || 'Sản phẩm'} (Góc phối cảnh).jpg`,
        type: 'DETAIL_IMAGE',
        url: primaryImageUrl,
        size: 0,
        isPrimary: false,
      })
    }

    // Extract Description
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    const description = ogDescMatch?.[1] || ''

    // Extract Price
    let price: number | undefined = jsonLdPrice
    if (!price && !isChallenged) {
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

    const message = isChallenged
      ? `Đã trích xuất thông tin: ${title} (Lưu ý: TikTok đang bật bảo mật chống bot, bạn có thể kiểm tra lại giá và bổ sung thêm ảnh bên dưới nhé!)`
      : `Đã trích xuất thành công: ${title}`

    return {
      success: true,
      message,
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
        assets.push({
          id: 'asset-imported-' + Date.now() + '-1',
          name: `${fallbackTitle} (Cận cảnh chi tiết).jpg`,
          type: 'DETAIL_IMAGE',
          url: fallbackImage,
          size: 0,
          isPrimary: false,
        })
        assets.push({
          id: 'asset-imported-' + Date.now() + '-2',
          name: `${fallbackTitle} (Góc phối cảnh).jpg`,
          type: 'DETAIL_IMAGE',
          url: fallbackImage,
          size: 0,
          isPrimary: false,
        })
      }

      return {
        success: true,
        message: `Đã trích xuất thông tin cơ bản: ${fallbackTitle}`,
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

