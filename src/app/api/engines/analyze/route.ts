import { NextRequest, NextResponse } from 'next/server'
import { ProductInput } from '@/engines/core/types'
import { analyzeProductWithGemini } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

interface AnalyzeRequestBody extends ProductInput {
  geminiApiKey?: string
  targetDuration?: 15 | 30 | 45
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

    const { geminiApiKey, targetDuration, ...product } = body

    const result = await analyzeProductWithGemini(
      product,
      geminiApiKey,
      targetDuration || 15
    )

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      strategy: result.strategy,
      storyboard: result.storyboard,
      creativePlan: result.creativePlan,
      suggestedCaption: result.suggestedCaption,
      suggestedHashtags: result.suggestedHashtags,
      engine: {
        id: 'home-utility-engine',
        name: 'Home & Utility Engine (Vipee Creative Director Powered)',
        category: 'home',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi khi phân tích sản phẩm với Gemini' },
      { status: 500 }
    )
  }
}
