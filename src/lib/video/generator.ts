import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { generateVietnameseTTS } from '@/lib/audio/tts'
import { StoryboardScene } from '@/engines/core/types'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'

const execPromise = promisify(exec)

export interface RenderVideoParams {
  productName: string
  price?: number
  scenes: StoryboardScene[]
  imageBuffer?: Buffer
  imageBuffers?: Buffer[]
  imageUrls?: string[]
  imageMimeType?: string
  voicePreset?: 'Natural Friend' | 'Warm Reviewer' | 'Curious Tester' | 'Energetic Seller' | 'Calm Explainer'
}

export interface RenderVideoResult {
  filePath: string
  fileName: string
  duration: number
  fileSizeBytes: number
}

/**
 * Escapes text for ffmpeg drawtext filter
 */
function escapeFfmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
}

/**
 * Renders a full 15-second TikTok UGC video (1080x1920 vertical, 30fps, H264 + AAC)
 */
export async function renderProductVideo(
  params: RenderVideoParams
): Promise<RenderVideoResult> {
  const ffmpeg = getFfmpegBinaryPath()
  const tempDir = path.join('/tmp', 'aff-render-' + Date.now())
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    // 1. Prepare Product Images for each scene
    const availableImagePaths: string[] = []

    if (params.imageBuffers && params.imageBuffers.length > 0) {
      for (let idx = 0; idx < params.imageBuffers.length; idx++) {
        const imgPath = path.join(tempDir, `product_img_${idx}.png`)
        fs.writeFileSync(imgPath, params.imageBuffers[idx])
        availableImagePaths.push(imgPath)
      }
    } else if (params.imageUrls && params.imageUrls.length > 0) {
      for (let idx = 0; idx < params.imageUrls.length; idx++) {
        try {
          const imgRes = await fetch(params.imageUrls[idx], {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          })
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer())
            const imgPath = path.join(tempDir, `product_img_${idx}.png`)
            fs.writeFileSync(imgPath, buf)
            availableImagePaths.push(imgPath)
          }
        } catch (e) {
          console.warn(`[VideoGenerator] Failed to fetch image ${idx}:`, e)
        }
      }
    } else if (params.imageBuffer && params.imageBuffer.length > 0) {
      const imgPath = path.join(tempDir, 'product_img_0.png')
      fs.writeFileSync(imgPath, params.imageBuffer)
      availableImagePaths.push(imgPath)
    }

    if (availableImagePaths.length === 0) {
      const fallbackPath = path.join(tempDir, 'product_img_fallback.png')
      const createImgCmd = `${ffmpeg} -y -f lavfi -i color=c=0x18181b:s=800x800:d=1 -vframes 1 "${fallbackPath}"`
      await execPromise(createImgCmd)
      availableImagePaths.push(fallbackPath)
    }

    // 2. Audio-First Timeline: Generate Voiceover with VipeeSpeechDirector and VipeeTTSProvider
    const speechDirector = new VipeeSpeechDirector()
    const speechPlan = speechDirector.createSpeechPlan(
      {
        scenes: params.scenes.map((s) => ({
          id: s.id,
          voice: s.voice || s.headline,
          storyBeat: s.type || 'demo',
          emphasisWords: s.keywords,
        })),
      },
      {
        voicePreset: params.voicePreset || 'Natural Friend',
      }
    )

    const ttsProvider = new VipeeTTSProvider()
    const speechAudioResult = await ttsProvider.generateSpeech(speechPlan)

    const masterVoicePath = path.join(tempDir, 'master_voice.mp3')
    fs.writeFileSync(masterVoicePath, speechAudioResult.audioBuffer)

    // 4. Build 5 Video Segments (3 seconds each)
    const segmentFiles: string[] = []
    const fontPath = fs.existsSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
      ? '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
      : fs.existsSync('/System/Library/Fonts/Supplemental/Arial.ttf')
      ? '/System/Library/Fonts/Supplemental/Arial.ttf'
      : fs.existsSync('/System/Library/Fonts/Helvetica.ttc')
      ? '/System/Library/Fonts/Helvetica.ttc'
      : ''

    const fontParam = fontPath ? `:fontfile='${fontPath}'` : ''

    for (let i = 0; i < params.scenes.length; i++) {
      const scene = params.scenes[i]
      const timing = speechAudioResult.segmentTimings.find((t) => t.segmentId === scene.id)
      const sceneDuration = timing ? timing.durationSec : (scene.duration && scene.duration > 0 ? scene.duration : 3)
      const segPath = path.join(tempDir, `segment_${i}.mp4`)
      segmentFiles.push(segPath)

      const badgeText = escapeFfmpegText(
        i === 0
          ? '🔥 HOT TIKTOK • 3 GIÂY ĐẦU'
          : i === params.scenes.length - 1
          ? '🛒 TIKTOK SHOP • GÓC TRÁI'
          : scene.type === 'problem'
          ? '😫 VẤN ĐỀ HAY GẶP'
          : scene.type === 'demo'
          ? '✨ TRẢI NGHIỆM THỰC TẾ'
          : scene.type === 'benefit'
          ? '🎉 KẾT QUẢ THỎA MÃN'
          : '💡 GIẢI PHÁP TỨC THÌ'
      )

      const headlineEscaped = escapeFfmpegText(scene.headline.slice(0, 42))
      const voiceSubtitle = escapeFfmpegText((scene.voice || scene.headline).slice(0, 55))

      // Contextual Background selection based on product name
      const pNameLower = params.productName.toLowerCase()
      const bgFilename =
        pNameLower.includes('dây') || pNameLower.includes('bàn') || pNameLower.includes('sạc') || pNameLower.includes('office')
          ? 'desk_workspace.png'
          : pNameLower.includes('bếp') || pNameLower.includes('gia vị') || pNameLower.includes('nồi')
          ? 'kitchen_modern.png'
          : 'minimal_lifestyle.png'

      const bgImagePath = path.join(process.cwd(), 'public', 'backgrounds', bgFilename)
      const hasBgImage = fs.existsSync(bgImagePath)

      const sceneImgPath = availableImagePaths[i % availableImagePaths.length]

      // Dynamic Ken Burns Zoom on both background and product card (creating 3D depth parallax)
      const bgScaleRate = i === 0 ? 0.02 : i === 2 ? 0.025 : 0.015
      const prodScaleRate = i === 0 ? 0.045 : i === 2 ? 0.05 : i === 3 ? 0.03 : 0.02

      // Feature callout stamp for demo/reveal scenes in proper Vietnamese
      const calloutText = escapeFfmpegText(
        i === 0
          ? 'CẢNH BÁO • BỪA BỘN ⚠️'
          : i === 1
          ? 'BẤT TIỆN HÀNG NGÀY 😩'
          : i === 2
          ? 'GIẢI PHÁP 10/10 ⭐ CỨU TINH'
          : i === 3
          ? (scene.keywords && scene.keywords[0])
            ? `${scene.keywords[0].slice(0, 16).toUpperCase()} ✨ TIỆN LỢI`
            : 'GỌN GÀNG 100% ✨ THÔNG MINH'
          : i === 4
          ? 'SĂN DEAL HỜI • MUA NGAY 🛍️'
          : 'GIỎ HÀNG GÓC TRÁI 🛒'
      )

      // Multi-layer FFmpeg filtergraph:
      // 1. Background layer with continuous cinematic parallax drift
      // 2. Product Card: Framed inside sleek card + dynamic smooth Ken Burns scale
      // 3. Composite scaling product card centered over background
      // 4. Top animated TikTok Progress Line (red/rose fill progressing from left to right)
      // 5. Top Story Beat Badge (Amber/Gold pill)
      // 6. Feature Callout Stamp (floating above product)
      // 7. Main Headline Box (Slate/Dark with bold text)
      // 8. Dynamic Subtitle (Clean high-contrast white)
      // 9. Bottom High-CTR Affiliate CTA Pill (Cyan/Teal)
      const filterComplex = [
        // 1. Animated background with smooth multi-threaded parallax drift
        `[0:v]scale='1080*(1+${bgScaleRate}*t)':'1920*(1+${bgScaleRate}*t)':eval=frame,crop=1080:1920[bg]`,
        // 2. Product Card: Padded inside a modern dark card (760x760) with dynamic Ken Burns zoom
        `[1:v]scale=720:720:force_original_aspect_ratio=decrease,pad=760:760:(ow-iw)/2:(oh-ih)/2:color=0x18181b@0.9,scale='760*(1+${prodScaleRate}*t)':'760*(1+${prodScaleRate}*t)':eval=frame[prod]`,
        // 3. Composite product over background keeping center position
        `[bg][prod]overlay=(W-w)/2:430-(h-760)/2[comp]`,
        // 4. Animated TikTok Progress Line at top
        `[comp]drawbox=x=0:y=0:w='iw*t/${sceneDuration}':h=10:color=0xf43f5e@0.95:t=fill[prog]`,
        // 5. Top Story Beat Badge
        `[prog]drawtext=text='${badgeText}'${fontParam}:fontcolor=0xfacc15:fontsize=36:x=(w-text_w)/2:y=180:box=1:boxcolor=0x000000@0.8:boxborderw=18[b1]`,
        // 6. Floating Feature Callout Sticker Stamp
        `[b1]drawtext=text='${calloutText}'${fontParam}:fontcolor=0x38bdf8:fontsize=28:x=(w-text_w)/2:y=255:box=1:boxcolor=0x0f172a@0.85:boxborderw=12[b2]`,
        // 7. Main Headline Box
        `[b2]drawtext=text='${headlineEscaped}'${fontParam}:fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1270:box=1:boxcolor=0x0f172a@0.92:boxborderw=22[b3]`,
        // 8. Subtitle line
        `[b3]drawtext=text='${voiceSubtitle}'${fontParam}:fontcolor=0xf8fafc:fontsize=32:x=(w-text_w)/2:y=1380:box=1:boxcolor=0x000000@0.7:boxborderw=16[b4]`,
        // 9. Bottom TikTok Shop High-CTR Pill
        `[b4]drawtext=text='GIỎ HÀNG GÓC TRÁI • XEM NGAY 🛒'${fontParam}:fontcolor=0x09090b:fontsize=36:x=(w-text_w)/2:y=1510:box=1:boxcolor=0x38bdf8@0.95:boxborderw=20[out]`,
      ].join(';')

      const bgInput = hasBgImage
        ? `-loop 1 -t ${sceneDuration} -i "${bgImagePath}"`
        : `-f lavfi -i color=c=0x18181b:s=1080x1920:d=${sceneDuration}:r=30`

      const cmd = [
        `"${ffmpeg}" -y`,
        bgInput,
        `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
        `-filter_complex "${filterComplex}"`,
        `-map "[out]"`,
        `-c:v libx264 -pix_fmt yuv420p -r 30`,
        `"${segPath}"`,
      ].join(' ')

      await execPromise(cmd)
    }

    // 5. Concatenate video segments
    const videoConcatListPath = path.join(tempDir, 'video_concat.txt')
    fs.writeFileSync(
      videoConcatListPath,
      segmentFiles.map((f) => `file '${f}'`).join('\n')
    )

    const rawCombinedVideoPath = path.join(tempDir, 'raw_video.mp4')
    await execPromise(
      `${ffmpeg} -y -f concat -safe 0 -i "${videoConcatListPath}" -c copy "${rawCombinedVideoPath}"`
    )

    // 6. Final Sound Design: Combine Video + Master Voice + Synced SFX + Ducked BGM into final MP4
    const outputFileName = `product_video_${Date.now()}.mp4`
    const outputDir = path.join(process.cwd(), 'public', 'renders')
    fs.mkdirSync(outputDir, { recursive: true })
    const finalOutputPath = path.join(outputDir, outputFileName)

    const bgmPath = path.join(process.cwd(), 'public', 'music', 'lofi-beat.aac')
    const whooshPath = path.join(process.cwd(), 'public', 'sfx', 'whoosh.mp3')
    const popPath = path.join(process.cwd(), 'public', 'sfx', 'pop.mp3')

    const hasBgm = fs.existsSync(bgmPath)
    const hasWhoosh = fs.existsSync(whooshPath)

    let finalCmd: string
    if (hasBgm && hasWhoosh) {
      // Audio Ducking: Voice at volume 1.3, Whoosh SFX at 0.8, BGM ducked at 0.12
      finalCmd = [
        `"${ffmpeg}" -y`,
        `-i "${rawCombinedVideoPath}"`,
        `-i "${masterVoicePath}"`,
        `-stream_loop -1 -i "${bgmPath}"`,
        `-i "${whooshPath}"`,
        `-filter_complex "[1:a]volume=1.3[v];[2:a]volume=0.12[m];[3:a]volume=0.8[sfx];[v][m][sfx]amix=inputs=3:duration=first:dropout_transition=2[aout]"`,
        `-map 0:v -map "[aout]"`,
        `-c:v copy -c:a aac -b:a 128k -shortest`,
        `"${finalOutputPath}"`,
      ].join(' ')
    } else if (hasBgm) {
      finalCmd = [
        `"${ffmpeg}" -y`,
        `-i "${rawCombinedVideoPath}"`,
        `-i "${masterVoicePath}"`,
        `-stream_loop -1 -i "${bgmPath}"`,
        `-filter_complex "[1:a]volume=1.3[v];[2:a]volume=0.14[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2[aout]"`,
        `-map 0:v -map "[aout]"`,
        `-c:v copy -c:a aac -b:a 128k -shortest`,
        `"${finalOutputPath}"`,
      ].join(' ')
    } else {
      finalCmd = [
        `"${ffmpeg}" -y`,
        `-i "${rawCombinedVideoPath}"`,
        `-i "${masterVoicePath}"`,
        `-map 0:v -map 1:a`,
        `-c:v copy -c:a aac -b:a 128k -shortest`,
        `"${finalOutputPath}"`,
      ].join(' ')
    }

    await execPromise(finalCmd)

    const stats = fs.statSync(finalOutputPath)

    const totalDuration = speechAudioResult.durationSec || params.scenes.reduce(
      (acc, s) => acc + (s.duration && s.duration > 0 ? s.duration : 3),
      0
    )

    return {
      filePath: finalOutputPath,
      fileName: outputFileName,
      duration: Math.round(totalDuration),
      fileSizeBytes: stats.size,
    }
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (e) {
      console.warn('[VideoGenerator] Cleanup error:', e)
    }
  }
}
