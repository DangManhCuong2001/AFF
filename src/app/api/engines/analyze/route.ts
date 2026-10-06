import { NextRequest, NextResponse } from 'next/server'
import { engineRegistry } from '@/engines/core/engine-registry'
import { ProductInput, ProductCategory } from '@/engines/core/types'
// Import HomeUtilityEngine to ensure auto-registration
import '@/engines/home/HomeUtilityEngine'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const product = (await request.json()) as ProductInput

    if (!product || !product.name) {
      return NextResponse.json(
        { error: 'Tên sản phẩm là bắt buộc để phân tích' },
        { status: 400 }
      )
    }

    const category: ProductCategory = product.category || 'home'
    const engine = engineRegistry.getEngine(category)

    if (!engine) {
      return NextResponse.json(
        { error: `Engine cho ngành hàng "${category}" chưa được kích hoạt` },
        { status: 400 }
      )
    }

    const analysis = await engine.analyzeProduct(product)
    const strategy = await engine.generateStrategy(product, analysis)
    const storyboard = await engine.generateStoryboard(product, strategy)

    return NextResponse.json({
      success: true,
      engine: {
        id: engine.id,
        name: engine.name,
        category: engine.category,
      },
      analysis,
      strategy,
      storyboard,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi khi phân tích sản phẩm' },
      { status: 500 }
    )
  }
}
