import { NextRequest, NextResponse } from 'next/server'
import { ProductInput } from '@/engines/core/types'
import { VipeeCreativeDirector } from '@/engines/creative/VipeeCreativeDirector'
import { VipeeSpeechDirector } from '@/engines/speech/VipeeSpeechDirector'
import { StoryApproach } from '@/engines/creative/types'
import { VoicePersonality } from '@/engines/speech/types'

export const dynamic = 'force-dynamic'

interface PlanRequestBody extends ProductInput {
  targetDuration?: 15 | 30 | 45
  approach?: StoryApproach
  voicePreset?: VoicePersonality
  geminiApiKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlanRequestBody

    if (!body || !body.name) {
      return NextResponse.json(
        { error: 'Tên sản phẩm là bắt buộc để lập Creative Plan' },
        { status: 400 }
      )
    }

    const { targetDuration, approach, voicePreset, geminiApiKey, ...product } = body
    const effectiveApiKey = geminiApiKey || process.env.GEMINI_API_KEY

    // 1. Creative Director Layer
    const director = new VipeeCreativeDirector()
    const creativePlan = await director.createCreativePlan(
      product,
      {
        productType: product.name,
        mainProblem: product.problemSolved || 'Bừa bộn và bất tiện thường ngày',
        mainBenefit: product.benefits?.[0] || 'Gọn gàng và tiện lợi tức thì',
        secondaryBenefits: product.benefits?.slice(1) || [],
        targetAudience: product.targetAudience || 'Gia đình, người đi làm',
        sellingMechanism: 'PROBLEM_SOLVE_DEMO',
        visualDemoPotential: 'high',
        recommendedFormat: approach || 'micro-story',
        reasoningSummary: 'Phù hợp nhất với tâm lý khách hàng TikTok UGC',
        claimsAllowed: [],
        claimsToAvoid: [],
      },
      {
        targetDuration: targetDuration || 15,
        approach,
        geminiApiKey: effectiveApiKey,
      }
    )

    // 2. Speech Director Layer
    const speechDirector = new VipeeSpeechDirector()
    const speechPlan = speechDirector.createSpeechPlan(
      {
        scenes: [
          {
            id: 'scene-1',
            storyBeat: 'hook',
            voice: creativePlan.selectedHook.text,
          },
          {
            id: 'scene-2',
            storyBeat: 'problem',
            voice: creativePlan.viewerInsight,
          },
          {
            id: 'scene-3',
            storyBeat: 'reveal',
            voice: `Cho đến khi mình thử dùng ${product.name} này.`,
          },
          {
            id: 'scene-4',
            storyBeat: 'payoff',
            voice: creativePlan.payoff,
          },
          {
            id: 'scene-5',
            storyBeat: 'cta',
            voice: creativePlan.cta,
          },
        ],
      },
      {
        voicePreset: voicePreset || 'Natural Friend',
      }
    )

    return NextResponse.json({
      success: true,
      creativePlan,
      speechPlan,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi khi lập Creative Plan' },
      { status: 500 }
    )
  }
}
