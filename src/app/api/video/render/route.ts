import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { renderProductVideo } from '@/lib/video/generator'
import { StoryboardScene } from '@/engines/core/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const productName = (formData.get('productName') as string) || 'Sản phẩm gia dụng thông minh'
    const priceStr = formData.get('price') as string
    const price = priceStr ? Number(priceStr) : undefined
    const voicePreset = (formData.get('voicePreset') as any) || undefined
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
        ? 'Góc bếp ai mà lộn xộn chai lọ gia vị thì dừng lại 3 giây xem ngay mẹo này nha!'
        : isCable
        ? 'Ai mà mỗi lần ngồi vào bàn là phát bực vì dây sạc rối tung rối mù thì xem ngay nha!'
        : `Ai mà hay bị phiền toái vì đồ đạc bừa bộn thì xem ngay món đồ cứu tinh này nha!`

      const problemVoice = isKitchen
        ? 'Mỗi lần nấu ăn vội mà tìm gia vị lỉnh kỉnh, nắp lỏng lẻo ẩm mốc phát bực luôn á!'
        : isCable
        ? 'Bình thường cúi xuống gầm bàn nhặt dây vừa bẩn vừa mỏi lưng, dây lại còn nhanh gãy đứt nữa chứ!'
        : 'Bình thường đồ đạc cứ vứt lung tung mỗi lần tìm phát bực, mất bao nhiêu thời gian luôn!'

      const demoVoice = isKitchen
        ? `Cho đến khi mình thử bộ hũ này, nắp bật một chạm kèm muỗng kín khí siêu tiện lợi!`
        : isCable
        ? `May mà mình tậu được cái miếng kẹp này, dán mép bàn một phát là giữ chắc nịch mọi loại dây luôn á!`
        : `May mà mình tìm được ${productName} này, nhỏ xíu mà tiện dã man luôn á!`

      const benefitVoice = isKitchen
        ? 'Gian bếp gọn gàng sang xịn hẳn lên, nấu nướng tiện lợi 10 điểm không có nhưng!'
        : isCable
        ? 'Bàn làm việc gọn gàng 10 điểm luôn, cần cắm sạc máy gì với tay là lấy được ngay!'
        : 'Dùng một cái là ưng cái bụng liền, không gian gọn gàng ngăn nắp 10 điểm luôn!'

      const ctaVoice = 'Mọi người bấm ngay giỏ hàng góc trái bên dưới để săn deal ưu đãi hôm nay nhé!'

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
      voicePreset,
    })

    // Return direct MP4 stream for 100% resilience on serverless Lambda environments
    const fileBuffer = fs.readFileSync(result.filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(result.fileSizeBytes),
        'X-Video-Filename': result.fileName,
        'X-Video-Duration': String(result.duration),
        'X-Video-Filesize': String(result.fileSizeBytes),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    console.error('[VideoRenderAPI] Error:', err)
    return NextResponse.json(
      { error: (err as Error)?.message || 'Lỗi trong quá trình render video' },
      { status: 500 }
    )
  }
}

