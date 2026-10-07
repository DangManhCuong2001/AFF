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
      const nameLower = productName.toLowerCase()
      const isKitchen = nameLower.includes('gia vị') || nameLower.includes('bếp') || nameLower.includes('hũ') || nameLower.includes('nồi')
      const isCable = nameLower.includes('dây sạc') || nameLower.includes('cable') || nameLower.includes('kẹp dây')

      const hookVoice = isKitchen
        ? 'Góc bếp mà lộn xộn gia vị nấu nướng thì xem ngay giải pháp này nhé.'
        : isCable
        ? 'Nhà ai dây sạc cứ rơi lung tung thì xem ngay mẹo này.'
        : `Bạn đã biết đến ${productName} cực kỳ tiện lợi này chưa?`

      const problemVoice = isKitchen
        ? 'Mỗi lần nấu ăn tìm gia vị bừa bộn làm mất thời gian và dễ bị ẩm mốc.'
        : isCable
        ? 'Bình thường dây sạc rơi xuống đất vừa bẩn vừa bất tiện.'
        : 'Đồ đạc bừa bộn tìm mãi không thấy làm mất thời gian của bạn.'

      const demoVoice = isKitchen
        ? `Bộ hũ trong suốt nắp bật thông minh kèm muỗng múc cực kỳ kín khí và tiện lợi.`
        : isCable
        ? `Chỉ cần cố định miếng kẹp này là giữ ngay ngắn mọi loại dây sạc.`
        : `Chỉ cần dùng ${productName} này là sắp xếp gọn gàng ngay tức thì.`

      const benefitVoice = isKitchen
        ? 'Gian bếp gọn gàng đẹp mắt hẳn lên, nấu nướng nhanh và tiện lợi hơn rất nhiều.'
        : isCable
        ? 'Bàn làm việc gọn gàng đẹp mắt hẳn lên, cần là với tay lấy được ngay.'
        : 'Không gian sống gọn gàng và tiện nghi hơn rất nhiều sau khi sử dụng.'

      const ctaVoice = 'Giá cực kỳ ưu đãi, bạn bấm vào giỏ hàng góc trái màn hình để xem nhé.'

      scenes = [
        {
          id: 's1',
          type: 'hook',
          duration: 3,
          headline: isKitchen ? 'Góc bếp lộn xộn gia vị?' : 'Bạn đã biết mẹo này chưa?',
          voice: hookVoice,
          tts: hookVoice,
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's2',
          type: 'problem',
          duration: 3,
          headline: 'Vấn đề hay gặp phải',
          voice: problemVoice,
          tts: problemVoice,
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's3',
          type: 'demo',
          duration: 3,
          headline: 'Giải pháp thông minh',
          voice: demoVoice,
          tts: demoVoice,
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's4',
          type: 'benefit',
          duration: 3,
          headline: 'Gọn gàng và tiện lợi',
          voice: benefitVoice,
          tts: benefitVoice,
          productAssetIds: [],
          backgroundType: 'color',
        },
        {
          id: 's5',
          type: 'cta',
          duration: 3,
          headline: 'Bấm góc trái mua ngay',
          voice: ctaVoice,
          tts: ctaVoice,
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
