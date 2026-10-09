import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
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
    const category = (formData.get('category') as string) || undefined
    const voicePreset = (formData.get('voicePreset') as import('@/engines/speech/types').VoicePersonality) || undefined
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
      const hookVoice = `Bạn đã biết đến ${productName} cực kỳ tiện lợi này chưa?`
      const problemVoice = 'Đồ đạc bừa bộn tìm mãi không ra, vừa mất thời gian lại dễ bực mình mỗi khi cần dùng gấp.'
      const demoVoice = `May mà mình tìm được ${productName} này, nhỏ gọn mà tiện dụng dã man luôn á!`
      const benefitVoice = 'Dùng một cái là ưng cái bụng liền, không gian gọn gàng ngăn nắp 10 điểm luôn!'
      const ctaVoice = 'Mọi người bấm ngay giỏ hàng góc trái bên dưới để săn deal ưu đãi hôm nay nhé!'

      scenes = [
        {
          id: 's1',
          type: 'hook',
          duration: 3,
          headline: `Khám phá ${productName.slice(0, 20)}`,
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

    // 3. Check for pre-generated audio track from client
    const audioFile = (formData.get('audio') || formData.get('voice')) as File | null
    let masterAudioBuffer: Buffer | undefined = undefined
    if (audioFile && typeof audioFile.arrayBuffer === 'function') {
      try {
        const bytes = await audioFile.arrayBuffer()
        if (bytes.byteLength > 100) {
          masterAudioBuffer = Buffer.from(bytes)
          console.log(`[VideoRenderAPI] Received pre-synthesized audio track: ${(masterAudioBuffer.length / 1024).toFixed(1)} KB`)
        }
      } catch (audioErr) {
        console.warn('[VideoRenderAPI] Failed to read audio buffer from formData:', audioErr)
      }
    }

    // Render video using high-performance FFmpeg engine
    const result = await renderProductVideo({
      productName,
      price,
      category,
      scenes,
      imageBuffers: imageBuffers.length > 0 ? imageBuffers : undefined,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      voicePreset,
      masterAudioBuffer,
    })

    // Also persist into public/renders for immediate direct URL access
    try {
      const publicRendersDir = path.join(process.cwd(), 'public', 'renders')
      fs.mkdirSync(publicRendersDir, { recursive: true })
      fs.copyFileSync(result.filePath, path.join(publicRendersDir, result.fileName))
    } catch (copyErr) {
      // Safe to ignore on read-only serverless filesystems
      console.warn('[VideoRenderAPI] Failed to copy to public/renders (safe on serverless):', copyErr)
    }

    // Return direct MP4 stream for instant playback & download
    const fileBuffer = fs.readFileSync(result.filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(result.fileSizeBytes),
        'X-Video-Filename': result.fileName,
        'X-Video-Duration': String(result.duration),
        'X-Video-Filesize': String(result.fileSizeBytes),
        'X-Video-Url': `/renders/${result.fileName}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const errorStack = err instanceof Error ? err.stack : undefined
    console.error('[VideoRenderAPI] Render error:', errorMsg, errorStack)
    return NextResponse.json(
      {
        error: errorMsg || 'Lỗi trong quá trình render video',
        details: errorStack,
      },
      { status: 500 }
    )
  }
}

