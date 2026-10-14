import { NextRequest, NextResponse } from 'next/server'
import { ProductInput } from '@/engines/core/types'
import { analyzeProductWithGemini, AnalysisImage } from '@/lib/ai/gemini'
import { ProductInputSchema, ProductAssetSchema } from '@/engines/core/contracts'
import type { ContentAngle } from '@/engines/planning/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface AnalyzeRequestBody extends ProductInput {
  geminiApiKey?: string
  targetDuration?: number
  angle?: ContentAngle
  analysisImages?: AnalysisImage[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody

    if (!body || !body.name) {
      return NextResponse.json(
        { error: 'Tên sản phẩm là bắt buộc để phân tích' },
        { status: 400 }
      )
    }

    const { geminiApiKey, targetDuration, angle, analysisImages, ...input } = body
    const parsed = ProductInputSchema.extend({assets: ProductAssetSchema.array().max(30)}).safeParse(input)
    if (!parsed.success || (angle && !['design', 'features', 'fit'].includes(angle)) || (targetDuration !== undefined && ![15, 22, 30, 45].includes(targetDuration))) {
      return NextResponse.json({error: 'Thông tin sản phẩm hoặc lựa chọn video không hợp lệ'}, {status: 400})
    }
    if (analysisImages && (!Array.isArray(analysisImages) || analysisImages.length > 3 || analysisImages.some((image) => typeof image?.assetId !== 'string' || typeof image?.dataUrl !== 'string' || image.dataUrl.length > 900_000))) {
      return NextResponse.json({error: 'Ảnh phân tích không hợp lệ hoặc quá lớn'}, {status: 400})
    }
    const product = parsed.data

    const result = await analyzeProductWithGemini(
      product,
      geminiApiKey,
      targetDuration || 22,
      {angle, images: analysisImages}
    )

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      strategy: result.strategy,
      storyboard: result.storyboard,
      creativePlan: result.creativePlan,
      contentPlan: result.contentPlan,
      suggestedCaption: result.suggestedCaption,
      suggestedHashtags: result.suggestedHashtags,
      engine: {
        id: 'adaptive-video-planner',
        name: 'Adaptive Product Video Planner',
        category: product.category,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi khi phân tích sản phẩm với Gemini' },
      { status: 500 }
    )
  }
}
