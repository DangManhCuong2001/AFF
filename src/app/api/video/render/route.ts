import { NextRequest, NextResponse } from 'next/server'
import { renderProductVideo } from '@/lib/video/generator'
import { StoryboardScene } from '@/engines/core/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const productName = (formData.get('productName') as string) || 'Sản phẩm gia dụng thông minh'
    const priceStr = formData.get('price') as string
    const price = priceStr ? Number(priceStr) : undefined
    const storyboardRaw = formData.get('storyboard') as string

    let scenes: StoryboardScene[] = []
    if (storyboardRaw) {
      try {
        const parsed = JSON.parse(storyboardRaw)
        scenes = parsed.scenes || parsed
      } catch (e) {
        console.warn('Failed to parse storyboard JSON:', e)
      }
    }

    if (scenes.length === 0) {
      scenes = [
        {
          id: 's1',
          type: 'hook',
          duration: 3,
          headline: 'Ban da biet meo nay chua?',
          voice: 'Bạn đã biết mẹo này chưa? Nhìn đơn giản nhưng cực kỳ tiện lợi nhé.',
          tts: 'Bạn đã biết mẹo này chưa? Nhìn đơn giản nhưng cực kỳ tiện lợi nhé.',
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's2',
          type: 'problem',
          duration: 3,
          headline: 'Van de ban hay gap phai',
          voice: 'Bình thường dây cáp lộn xộn bừa bộn tìm mãi không thấy.',
          tts: 'Bình thường dây cáp lộn xộn bừa bộn tìm mãi không thấy.',
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's3',
          type: 'demo',
          duration: 3,
          headline: 'Giai phap don gian thong minh',
          voice: 'Chỉ cần gắn miếng kẹp silicon này lên mép bàn là xong ngay.',
          tts: 'Chỉ cần gắn miếng kẹp silicon này lên mép bàn là xong ngay.',
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's4',
          type: 'benefit',
          duration: 3,
          headline: 'Gon gang va tien loi tuc thi',
          voice: 'Bàn làm việc gọn gàng đẹp mắt hẳn lên, sạc lúc nào cũng tiện.',
          tts: 'Bàn làm việc gọn gàng đẹp mắt hẳn lên, sạc lúc nào cũng tiện.',
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's5',
          type: 'cta',
          duration: 3,
          headline: 'Bam goc trai mua ngay',
          voice: 'Giá cực kỳ rẻ, bạn bấm vào giỏ hàng góc trái màn hình để xem nhé.',
          tts: 'Giá cực kỳ rẻ, bạn bấm vào giỏ hàng góc trái màn hình để xem nhé.',
          productAssetIds: [],
          backgroundType: 'color',
        },
      ]
    }

    // 1. Check for multiple image files
    const imageFiles = formData.getAll('images') as File[]
    const imageBuffers: Buffer[] = []

    for (const f of imageFiles) {
      if (f && typeof f.arrayBuffer === 'function') {
        const bytes = await f.arrayBuffer()
        imageBuffers.push(Buffer.from(bytes))
      }
    }

    // Single image file fallback
    const singleImageFile = formData.get('image') as File | null
    if (singleImageFile && typeof singleImageFile.arrayBuffer === 'function' && imageBuffers.length === 0) {
      const bytes = await singleImageFile.arrayBuffer()
      imageBuffers.push(Buffer.from(bytes))
    }

    // 2. Check for image URLs (e.g. from TikTok Shop CDN)
    let imageUrls: string[] = []
    const imageUrlsRaw = formData.get('imageUrls') as string | null
    if (imageUrlsRaw) {
      try {
        const parsed = JSON.parse(imageUrlsRaw)
        if (Array.isArray(parsed)) imageUrls = parsed
      } catch (e) {
        console.warn('Failed to parse imageUrls JSON:', e)
      }
    }

    const result = await renderProductVideo({
      productName,
      price,
      scenes,
      imageBuffers: imageBuffers.length > 0 ? imageBuffers : undefined,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    })

    return NextResponse.json({
      success: true,
      videoUrl: `/renders/${result.fileName}`,
      fileName: result.fileName,
      duration: result.duration,
      fileSizeBytes: result.fileSizeBytes,
    })
  } catch (err: unknown) {
    console.error('[VideoRenderAPI] Error:', err)
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi trong quá trình render video' },
      { status: 500 }
    )
  }
}
