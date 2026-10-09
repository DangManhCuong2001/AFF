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
  price?: number
}

/**
 * Automatically upgrades ANY TikTok/ByteDance CDN image URL to crystal-clear, uncompressed Ultra HD original (origin-jpeg).
 * Eliminates blurry thumbnails (100x100, 200x200, 300x300, 800x800) by requesting the uncompressed master asset (~tplv-o3syd03w52-origin-jpeg.jpeg).
 */
export function upgradeTikTokImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl
  let url = rawUrl.trim().replace(/&amp;/g, '&')

  const isByteDanceCdn =
    url.includes('ibyteimg.com') ||
    url.includes('byteimg.com') ||
    url.includes('tiktokcdn.com') ||
    url.includes('tos-maliva') ||
    url.includes('tos-alisg') ||
    url.includes('tos-useast')

  if (isByteDanceCdn) {
    const defaultTpl = url.includes('tos-alisg') ? 'aphluv4xwc' : 'o3syd03w52'

    // 1. If URL contains template ~tplv-{tplId}-... replace with origin-jpeg preserving exact template ID
    const tplMatch = url.match(/~tplv-([a-zA-Z0-9]+)-/i)
    if (tplMatch && tplMatch[1]) {
      return url.replace(/~tplv-[^?#]+/i, `~tplv-${tplMatch[1]}-origin-jpeg.jpeg`)
    }
    if (url.includes('~tplv-')) {
      return url.replace(/~tplv-[^?#]+/i, `~tplv-${defaultTpl}-origin-jpeg.jpeg`)
    }
    // 2. If URL contains crop/resize tags like ~c5_ or ~resize- or ~crop-
    if (url.includes('~c5_') || url.includes('~resize-') || url.includes('~crop-')) {
      return url.replace(/~[^?#]+/i, `~tplv-${defaultTpl}-origin-jpeg.jpeg`)
    }
    // 3. If URL contains a 32-hex hash on tos-maliva
    const hashMatch = url.match(/\/tos-maliva[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/i)
    if (hashMatch && hashMatch[1]) {
      return `https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/${hashMatch[1]}~tplv-o3syd03w52-origin-jpeg.jpeg`
    }
    // 4. If URL contains a 32-hex hash on tos-alisg
    const alisgHash = url.match(/\/tos-alisg[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/i)
    if (alisgHash && alisgHash[1]) {
      return `https://p16-oec-sg.ibyteimg.com/tos-alisg-i-aphluv4xwc-sg/${alisgHash[1]}~tplv-aphluv4xwc-origin-jpeg.jpeg`
    }
  }

  return url
}

/**
 * Extracts price in VND from arbitrary user-pasted text (e.g. "Mua Tai nghe... giá ₫129.000", "99k", "150.000đ")
 */
export function extractPriceFromText(text: string): number | undefined {
  if (!text) return undefined
  const patterns = [
    /(?:giá|chỉ|deal|từ)?\s*₫\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/i,
    /(?:giá|chỉ|deal|từ)?\s*(\d{1,3}(?:[.,]\d{3})+)\s*(?:đ|₫|vnd|vnđ)?/i,
    /(?:giá|chỉ|deal|từ)?\s*(\d+)\s*(?:[kK]|k₫|kđ)/i,
    /(?:giá|chỉ|deal|từ)\s*[:\s]*(\d{4,})/i,
  ]
  for (const pat of patterns) {
    const match = text.match(pat)
    if (match && match[1]) {
      const isK = /[kK]/i.test(match[0])
      const digits = match[1].replace(/[^\d]/g, '')
      if (digits) {
        const num = parseInt(digits, 10)
        if (isK && num < 1000) return num * 1000
        if (num >= 1000) return num
      }
    }
  }
  return undefined
}

/**
 * Checks if a URL is a TikTok short share link
 */
export function isTikTokShortUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    return (
      u.hostname.includes('vt.tiktok.com') ||
      u.hostname.includes('vm.tiktok.com') ||
      (u.hostname.includes('tiktok.com') && u.pathname.startsWith('/t/'))
    )
  } catch {
    return false
  }
}

/**
 * Pre-resolves TikTok short share links to canonical redirected URL
 */
export async function resolveTikTokRedirect(urlStr: string): Promise<string> {
  try {
    const res = await fetch(urlStr, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9',
      },
    })
    return res.url || urlStr
  } catch (e) {
    console.warn('[TikTokShopImport] resolveTikTokRedirect error:', e)
    return urlStr
  }
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
 * Extract clean URL, potential title hint, and price hint from text copied from TikTok app share
 * (e.g. "Mua Tai nghe bluetooth tại TikTok Shop: https://vt.tiktok.com/ZS.../")
 */
export function extractUrlAndTitleHint(rawInput: string): {
  url: string
  titleHint: string
  priceHint?: number
} {
  const cleaned = rawInput.trim()
  const priceHint = extractPriceFromText(cleaned)
  const urlMatch = cleaned.match(/https?:\/\/[^\s"'<>]+/i)

  if (urlMatch) {
    const rawUrl = urlMatch[0].replace(/[),.;!]+$/, '')
    const targetUrl = cleanProductUrl(rawUrl)

    // Extract text hint from surrounding share text
    const textHint = cleaned
      .replace(urlMatch[0], '')
      .replace(/^(Xem|Mua|Đặt mua|Tham khảo|Check|Link)\s+/i, '')
      .replace(/(?:giá|chỉ|tại|trên)?\s*(?:₫|đ)?\s*[\d.,]+[kKđ₫]?.*$/i, '')
      .replace(/(tại|trên)?\s*TikTok Shop.*$/i, '')
      .replace(/[:!?,]/g, '')
      .trim()

    return {
      url: targetUrl,
      titleHint: isAntiBotOrGeneric(textHint) ? '' : textHint,
      priceHint,
    }
  }

  return {
    url: cleanProductUrl(cleaned),
    titleHint: '',
    priceHint,
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
    let price: number | undefined

    // 1. Check og_info param (TikTok Shop standard share payload containing {title, image, price})
    if (parsed.searchParams.has('og_info')) {
      try {
        const rawOg = parsed.searchParams.get('og_info')
        if (rawOg) {
          const parsedOg = JSON.parse(rawOg)
          if (parsedOg.title && typeof parsedOg.title === 'string' && !isAntiBotOrGeneric(parsedOg.title)) {
            title = parsedOg.title.trim()
          }
          if (parsedOg.image && typeof parsedOg.image === 'string' && parsedOg.image.startsWith('http')) {
            imageUrl = upgradeTikTokImageUrl(parsedOg.image.trim())
          }
          const rawP = parsedOg.price || parsedOg.real_price || parsedOg.sale_price || parsedOg.market_price
          if (rawP) {
            const digits = String(rawP).replace(/[^\d]/g, '')
            if (digits) {
              const p = parseInt(digits, 10)
              if (p >= 1000) price = p
            }
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
            imageUrl = upgradeTikTokImageUrl(val.trim())
            break
          }
        }
      }
    }

    // 4. Check price in query parameters
    if (!price) {
      for (const key of ['price', 'sale_price', 'real_price', 'item_price', 'product_price']) {
        if (parsed.searchParams.has(key)) {
          const val = parsed.searchParams.get(key)
          if (val) {
            const digits = String(val).replace(/[^\d]/g, '')
            if (digits) {
              const p = parseInt(digits, 10)
              if (p >= 1000) {
                price = p
                break
              }
            }
          }
        }
      }
    }

    // 5. Slug in path: /vn/pdp/sac-nhanh-20w-1729424888888 or /product/tai-nghe-123
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

    return { title, imageUrl, productId: productId || undefined, price }
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
    interface TikTokProductData {
      title?: string
      product_id?: string | number
      price?: {
        real_price?: string | number
        min_sku_price?: string | number
        sale_price_format?: string | number
        original_price?: string | number
      }
      skus?: Array<{
        price?: {
          sale_price_decimal?: string | number
          sale_price_format?: string | number
          origin_price_format?: string | number
        }
      }>
      images?: Array<{
        url_list?: string[]
        uri?: string
      }>
      sale_props?: Array<{
        sale_prop_values?: Array<{
          prop_value?: string
          image?: {
            uri?: string
            url_list?: string[]
          }
        }>
      }>
      desc_blocks?: Array<{
        type?: string
        text?: string
        content?: string[]
      }>
    }

    let productInfo: TikTokProductData | null = null
    const loaderData = (data.loaderData || {}) as Record<
      string,
      {
        page_config?: {
          components_map?: Array<{
            component_data?: {
              product_info?: TikTokProductData
            }
          }>
        }
      }
    >

    // Find component_data containing product_info
    for (const pageVal of Object.values(loaderData)) {
      if (pageVal?.page_config?.components_map) {
        for (const comp of pageVal.page_config.components_map) {
          if (comp.component_data?.product_info) {
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
          u = `https://p16-oec-va.ibyteimg.com/${img.uri}~tplv-o3syd03w52-origin-jpeg.jpeg`
        }
        u = upgradeTikTokImageUrl(u)
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
              let u =
                val.image.url_list?.[0] ||
                `https://p16-oec-va.ibyteimg.com/${val.image.uri}~tplv-o3syd03w52-origin-jpeg.jpeg`
              u = upgradeTikTokImageUrl(u)
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
 * Helper to fetch page via configured Scraping Proxy or Cloudflare Worker
 * Bypasses TikTok Security Check / Datacenter Geoblocking on Production (Vercel)
 */
async function fetchViaProxy(targetUrl: string): Promise<string | null> {
  const customProxyUrl = process.env.TIKTOK_SCRAPE_PROXY_URL?.trim()
  const scraperApiKey = process.env.SCRAPER_API_KEY?.trim()
  const zenrowsApiKey = process.env.ZENROWS_API_KEY?.trim()

  if (!customProxyUrl && !scraperApiKey && !zenrowsApiKey) {
    return null
  }

  let fetchUrl = ''
  if (customProxyUrl) {
    const sep = customProxyUrl.includes('?') ? '&' : '?'
    fetchUrl = `${customProxyUrl}${sep}url=${encodeURIComponent(targetUrl)}`
  } else if (scraperApiKey) {
    fetchUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}&country_code=vn`
  } else if (zenrowsApiKey) {
    fetchUrl = `https://api.zenrows.com/v1/?apikey=${zenrowsApiKey}&url=${encodeURIComponent(targetUrl)}&premium_proxy=true&proxy_country=vn`
  }

  if (!fetchUrl) return null

  try {
    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(15000),
    })
    if (res.ok) {
      const text = await res.text()
      if (text && !isAntiBotHtml(text) && text.includes('__MODERN_ROUTER_DATA__')) {
        return text
      }
    }
  } catch (err) {
    console.warn('[TikTokShopImport] fetchViaProxy failed:', (err as Error)?.message)
  }
  return null
}

/**
 * Helper to fetch TikTok PDP with cookie session warmup
 */
async function fetchTikTokPage(
  targetUrl: string,
  cleanPdpUrl?: string
): Promise<{ html: string; finalUrl: string }> {
  // Strategy 0: If Scraping Proxy / Cloudflare Worker is configured, prioritize proxy on production
  const hasProxy = Boolean(
    process.env.TIKTOK_SCRAPE_PROXY_URL?.trim() ||
      process.env.SCRAPER_API_KEY?.trim() ||
      process.env.ZENROWS_API_KEY?.trim()
  )

  if (hasProxy) {
    const proxyHtml = await fetchViaProxy(cleanPdpUrl || targetUrl)
    if (proxyHtml) {
      return { html: proxyHtml, finalUrl: cleanPdpUrl || targetUrl }
    }
  }

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
 * by reading Modern.js Router Data, OpenGraph metadata, and canonical web PDP.
 */
export async function importTikTokShopProduct(rawInput: string): Promise<TikTokShopImportResult> {
  const { url: targetUrl, titleHint, priceHint } = extractUrlAndTitleHint(rawInput)

  if (!targetUrl) {
    return {
      success: false,
      message: 'Vui lòng dán đường link sản phẩm TikTok Shop hợp lệ.',
      requiresManualFallback: false,
    }
  }

  // 1. If it's a short URL (vt.tiktok.com / vm.tiktok.com), pre-resolve redirect to get real final destination
  let resolvedUrl = targetUrl
  if (isTikTokShortUrl(targetUrl)) {
    resolvedUrl = await resolveTikTokRedirect(targetUrl)
  }

  // Pre-parse metadata directly from input URL and resolved URL
  const targetMeta = extractMetadataFromUrl(targetUrl)
  const resolvedMeta = extractMetadataFromUrl(resolvedUrl)
  let productId =
    resolvedMeta.productId ||
    targetMeta.productId ||
    extractTikTokShopProductId(resolvedUrl) ||
    extractTikTokShopProductId(targetUrl)

  const cleanPdpUrl = productId ? `https://shop.tiktok.com/vn/pdp/${productId}` : undefined

  try {
    let { html, finalUrl } = await fetchTikTokPage(
      resolvedUrl !== targetUrl ? resolvedUrl : targetUrl,
      cleanPdpUrl
    )
    const finalMeta = extractMetadataFromUrl(finalUrl)

    if (!productId) {
      productId = finalMeta.productId || extractTikTokShopProductId(finalUrl)
    }

    // ============================================================
    // Strategy 1: ByteDance Modern.js Router Data (__MODERN_ROUTER_DATA__)
    // This contains the full, authoritative product data with all gallery images and price!
    // ============================================================
    let modernData = parseModernRouterData(html)

    // CRITICAL: If initial request was challenged or returned non-modern HTML, but we have productId,
    // immediately fetch the modern canonical web PDP (/vn/pdp/:productId) which is NOT blocked by Security Check!
    if (!modernData && productId) {
      const canonicalPdp = `https://shop.tiktok.com/vn/pdp/${productId}`
      const proxyPdpHtml = await fetchViaProxy(canonicalPdp)
      if (proxyPdpHtml) {
        const canonicalModern = parseModernRouterData(proxyPdpHtml)
        if (canonicalModern) {
          modernData = canonicalModern
          finalUrl = canonicalPdp
          html = proxyPdpHtml
        }
      }
      if (!modernData) {
        try {
          const canonicalRes = await fetch(canonicalPdp, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              Accept: 'text/html',
              'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          })
          const canonicalHtml = await canonicalRes.text()
          const canonicalModern = parseModernRouterData(canonicalHtml)
          if (canonicalModern) {
            modernData = canonicalModern
            finalUrl = canonicalPdp
            html = canonicalHtml
          }
        } catch (err) {
          console.warn('[TikTokShopImport] canonical PDP fetch error:', err)
        }
      }
    }

    if (modernData) {
      const finalPrice =
        modernData.price || priceHint || resolvedMeta.price || targetMeta.price || finalMeta.price || 0
      return {
        success: true,
        message: `Đã trích xuất thành công: ${modernData.title} (${modernData.assets.length} ảnh gốc Ultra HD, giá: ${
          finalPrice > 0 ? finalPrice.toLocaleString('vi-VN') + '₫' : 'Liên hệ'
        })`,
        requiresManualFallback: false,
        extractedId: modernData.shopProductId || productId || undefined,
        product: {
          name: modernData.title,
          price: finalPrice > 0 ? finalPrice : '',
          description: modernData.description,
          productUrl: finalUrl || resolvedUrl || targetUrl,
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
    const bestUrlTitle = finalMeta.title || resolvedMeta.title || targetMeta.title || titleHint
    const bestUrlImage = finalMeta.imageUrl || resolvedMeta.imageUrl || targetMeta.imageUrl

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
          productUrl: finalUrl || resolvedUrl || targetUrl,
          shopProductId: productId || undefined,
          assets: [],
        },
      }
    }

    // Extract Gallery Images from HTML regex, upgrading ALL images to Ultra HD original
    const assets: ProductAsset[] = []
    const seenHashes = new Set<string>()

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
    let primaryImageUrl = upgradeTikTokImageUrl(bestUrlImage || jsonLdImage || ogImageMatch?.[1] || '')

    if (primaryImageUrl) {
      const hashMatch = primaryImageUrl.match(/tos-maliva[a-zA-Z0-9_\-]+\/([a-f0-9]{32})/)
      if (hashMatch) seenHashes.add(hashMatch[1])

      assets.push({
        id: 'asset-imported-' + Date.now() + '-0',
        name: `${title || 'Sản phẩm'} (Ảnh chính Ultra HD).jpg`,
        type: 'PRODUCT_IMAGE',
        url: primaryImageUrl,
        size: 0,
        isPrimary: true,
      })
    }

    // Extract secondary gallery images from page HTML by matching all unique image hashes
    const imgHashRegex = /tos-maliva[a-zA-Z0-9_\-]*\/([a-f0-9]{32})/gi
    let hashMatch: RegExpExecArray | null
    while ((hashMatch = imgHashRegex.exec(html)) !== null) {
      const hash = hashMatch[1]
      if (!seenHashes.has(hash) && assets.length < 8) {
        seenHashes.add(hash)
        const highResUrl = upgradeTikTokImageUrl(
          `https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/${hash}~tplv-o3syd03w52-origin-jpeg.jpeg`
        )
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

    // If only 1 image was obtained, expand into multi-scene perspective assets with the high-res original
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
    const description =
      ogDescMatch?.[1] ||
      `Sản phẩm ${title} tiện ích chính hãng trên TikTok Shop. Thiết kế thông minh, giải quyết bất tiện hàng ngày, độ bền cao và tiện lợi cho gia đình.`

    // Extract Price from all possible sources
    let price: number | undefined = jsonLdPrice
    if (!price) {
      const pricePatterns = [
        /"real_price":"?(\d+)"?/,
        /"format_price":"?([^",}]+)"?/,
        /"sale_price_format":"?([^",}]+)"?/,
        /"min_sku_price":"?(\d+)"?/,
        /"original_price":"?(\d+)"?/,
        /"price_display":"?([^",}]+)"?/,
        /"price":{"real_price":"?(\d+)"?/,
        /"price":(\d{4,})/,
      ]
      for (const pat of pricePatterns) {
        const m = html.match(pat)
        if (m && m[1]) {
          const num = parseInt(m[1].replace(/[^\d]/g, ''), 10)
          if (!isNaN(num) && num >= 1000) {
            price = num
            break
          }
        }
      }
    }
    if (!price) {
      price = priceHint || resolvedMeta.price || targetMeta.price || finalMeta.price
    }

    const message = isChallenged
      ? `Đã trích xuất thông tin: ${title} (${assets.length} ảnh gốc Ultra HD, giá: ${
          price ? price.toLocaleString('vi-VN') + '₫' : 'Chưa có giá'
        })`
      : `Đã trích xuất thành công: ${title} (${assets.length} ảnh gốc Ultra HD)`

    return {
      success: true,
      message,
      requiresManualFallback: false,
      extractedId: productId || undefined,
      product: {
        name: title,
        price: price || '',
        description,
        productUrl: finalUrl || resolvedUrl || targetUrl,
        shopProductId: productId || undefined,
        assets,
      },
    }
  } catch (err: unknown) {
    console.warn('[TikTokShopImport] Public HTML extract failed:', (err as Error).message)

    // Fallback: Recover metadata directly from URL params, resolved URL, and input text
    const fallbackMeta = extractMetadataFromUrl(resolvedUrl !== targetUrl ? resolvedUrl : targetUrl)
    const fallbackTitle = fallbackMeta.title || targetMeta.title || titleHint
    const rawFallbackImage = fallbackMeta.imageUrl || targetMeta.imageUrl
    const fallbackImage = rawFallbackImage ? upgradeTikTokImageUrl(rawFallbackImage) : undefined
    const fallbackPrice = priceHint || fallbackMeta.price || targetMeta.price || extractPriceFromText(rawInput) || ''

    if (fallbackTitle) {
      const assets: ProductAsset[] = []
      if (fallbackImage) {
        assets.push({
          id: 'asset-imported-' + Date.now() + '-0',
          name: `${fallbackTitle} (Ảnh chính Ultra HD).jpg`,
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
        message: `Đã trích xuất thông tin cơ bản: ${fallbackTitle} (Ảnh Ultra HD)`,
        requiresManualFallback: false,
        extractedId: productId || undefined,
        product: {
          name: fallbackTitle,
          price: fallbackPrice,
          description: `Sản phẩm ${fallbackTitle} tiện ích chính hãng trên TikTok Shop.`,
          productUrl: resolvedUrl || targetUrl,
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
        productUrl: resolvedUrl || targetUrl,
        shopProductId: productId || undefined,
      },
    }
  }
}


