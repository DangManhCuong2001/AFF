import { NextRequest, NextResponse } from 'next/server'
import { importTikTokShopProduct } from '@/lib/tiktok-shop/import'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const url = body.url as string | undefined

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Thiếu đường dẫn URL sản phẩm TikTok Shop' },
        { status: 400 }
      )
    }

    const result = await importTikTokShopProduct(url)
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi xử lý URL sản phẩm' },
      { status: 500 }
    )
  }
}
