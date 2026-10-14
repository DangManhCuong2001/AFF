import {NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {ProductInputSchema, ProductAssetSchema} from '@/engines/core/contracts'
import {analyzeProductWithGemini} from '@/lib/ai/gemini'
import {VipeeSpeechDirector} from '@/engines/speech/VipeeSpeechDirector'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const requestSchema = ProductInputSchema.extend({
  assets: ProductAssetSchema.array().max(30),
  targetDuration: z.union([z.literal(15), z.literal(22), z.literal(30), z.literal(45)]).default(22),
  angle: z.enum(['design', 'features', 'fit']).optional(),
  geminiApiKey: z.string().optional(),
  analysisImages: z.array(z.object({assetId: z.string(), dataUrl: z.string().max(900_000)})).max(3).optional(),
  voicePreset: z.enum(['Natural Friend', 'Warm Reviewer', 'Curious Tester', 'Energetic Seller', 'Calm Explainer']).default('Natural Friend'),
})

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({error: 'Thông tin sản phẩm hoặc lựa chọn video không hợp lệ'}, {status: 400})
    const {targetDuration, angle, geminiApiKey, analysisImages, voicePreset, ...product} = body.data
    const result = await analyzeProductWithGemini(product, geminiApiKey, targetDuration, {angle, images: analysisImages})
    const speechPlan = new VipeeSpeechDirector().createSpeechPlan({scenes: result.storyboard.scenes.map((scene) => ({id: scene.id, storyBeat: scene.type, voice: scene.voice}))}, {voicePreset})
    return NextResponse.json({success: true, ...result, speechPlan})
  } catch {
    return NextResponse.json({error: 'Không thể lập kế hoạch video. Vui lòng thử lại.'}, {status: 500})
  }
}
