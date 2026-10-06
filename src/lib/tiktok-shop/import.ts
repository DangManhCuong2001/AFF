import { ProductInput } from '@/engines/core/types'

export interface TikTokShopImportResult {
  success: boolean
  message: string
  product?: Partial<ProductInput>
  requiresManualFallback: boolean
  extractedId?: string
}

/**
 * Extract Product ID from official TikTok Shop URLs
 * Examples:
 * https://shop.tiktok.com/view/product/17293849201928374
 * https://vt.tiktok.com/...
 * https://www.tiktok.com/view/product/...
 */
export function extractTikTokShopProductId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim())

    // Direct /product/:id path
    const productMatch = url.pathname.match(/\/product\/(\d+)/i)
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
 * Import Product Information from TikTok Shop URL using Official API only.
 * Respects strict policy:
 * - NO HTML scraping
 * - NO browser automation / Playwright
 * - NO private cookies or reverse engineering
 *
 * Checks if official TikTok Shop Partner credentials & permissions exist.
 * If not present or not authorized for Product Catalog API, returns transparent fallback message.
 */
export async function importTikTokShopProduct(rawUrl: string): Promise<TikTokShopImportResult> {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return {
      success: false,
      message: 'Vui lòng dán đường link sản phẩm TikTok Shop hợp lệ.',
      requiresManualFallback: false,
    }
  }

  // Basic URL validation
  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return {
      success: false,
      message: 'Định dạng đường dẫn URL không hợp lệ.',
      requiresManualFallback: false,
    }
  }

  if (!parsedUrl.hostname.includes('tiktok.com')) {
    return {
      success: false,
      message: 'URL không phải từ tên miền chính thức của TikTok Shop (tiktok.com).',
      requiresManualFallback: false,
    }
  }

  const productId = extractTikTokShopProductId(trimmed)

  // Check official TikTok Shop Partner Credentials in environment
  const shopAppKey = process.env.TIKTOK_SHOP_APP_KEY
  const shopAppSecret = process.env.TIKTOK_SHOP_APP_SECRET

  if (!shopAppKey || !shopAppSecret) {
    return {
      success: false,
      message:
        'Automatic TikTok Shop product import is unavailable with the current API permissions (Tài khoản Developer hiện tại chưa cấp quyền TikTok Shop Product Catalog API).',
      requiresManualFallback: true,
      extractedId: productId || undefined,
      product: {
        productUrl: trimmed,
        shopProductId: productId || undefined,
      },
    }
  }

  // If credentials existed, we would query the official TikTok Shop Open API endpoint:
  // e.g. /product/202309/products/{product_id}
  // For now, official Shop Catalog permission is not active:
  return {
    success: false,
    message:
      'Automatic TikTok Shop product import is unavailable with the current API permissions. Vui lòng nhập thông tin sản phẩm và tải ảnh bên dưới.',
    requiresManualFallback: true,
    extractedId: productId || undefined,
    product: {
      productUrl: trimmed,
      shopProductId: productId || undefined,
    },
  }
}
