import {NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {generateContextImage} from '@/lib/ai/context-image'
import {ContextImageError} from '@/lib/ai/context-errors'

export const runtime = 'nodejs'
export const maxDuration = 60
const schema = z.object({name: z.string().min(1).max(500), category: z.string().max(100), reference: z.object({assetId: z.string(), dataUrl: z.string().max(900_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)})})
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({error: 'Cần ảnh sản phẩm hợp lệ để tạo bối cảnh.'}, {status: 400})
    const {name, category, reference} = parsed.data
    const imageUrl = await generateContextImage(name, category, reference)
    return NextResponse.json({success: true, imageUrl, provider: 'cloudflare'}, {headers: {'Cache-Control': 'no-store'}})
  } catch (error) {
    if (error instanceof ContextImageError) {
      return NextResponse.json({error: error.message, code: error.code, retryable: error.retryable}, {status: error.status})
    }
    return NextResponse.json({error: error instanceof Error ? error.message : 'Không thể tạo ảnh bối cảnh.'}, {status: 502})
  }
}
