import {NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {loadRemoteAnalysisImage} from '@/lib/ai/remote-image'
import {isAllowedProductImageUrl} from '@/lib/ai/remote-image-url'

export const runtime = 'nodejs'
export const maxDuration = 15
const schema = z.object({url: z.string().max(4096).refine(isAllowedProductImageUrl)})

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({error: 'Nguồn ảnh không được hỗ trợ. Hãy tải ảnh sản phẩm từ máy.'}, {status: 400})
    const image = await loadRemoteAnalysisImage(parsed.data.url)
    return new Response(new Uint8Array(image), {headers: {'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store'}})
  } catch {
    return NextResponse.json({error: 'Không đọc được ảnh từ link sản phẩm. Hãy tải ảnh sản phẩm từ máy.'}, {status: 502})
  }
}
