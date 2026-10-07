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

    // 4. Build Video Segments with multi-path font resolution
    const segmentFiles: string[] = []
    const fontCandidates = [
      path.join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Bold.ttf'),
      path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf'),
      path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Bold.ttf'),
      path.join(__dirname, '..', '..', '..', 'public', 'fonts', 'Roboto-Bold.ttf'),
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    ]

    let fontPath = ''
    for (const c of fontCandidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ c)) {
        fontPath = c
        break
      }
    }

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

      // Contextual Background selection based on product name
      const pNameLower = params.productName.toLowerCase()
      const bgFilename =
        pNameLower.includes('dây') || pNameLower.includes('bàn') || pNameLower.includes('sạc') || pNameLower.includes('office')
          ? 'desk_workspace.png'
          : pNameLower.includes('bếp') || pNameLower.includes('gia vị') || pNameLower.includes('nồi')
          ? 'kitchen_modern.png'
          : 'minimal_lifestyle.png'

      const bgCandidates = [
        path.join(process.cwd(), 'src', 'assets', 'backgrounds', bgFilename),
        path.join(process.cwd(), 'public', 'backgrounds', bgFilename),
        path.join(__dirname, '..', '..', 'assets', 'backgrounds', bgFilename),
        path.join(__dirname, '..', '..', '..', 'public', 'backgrounds', bgFilename),
      ]

      let bgImagePath = ''
      for (const b of bgCandidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ b)) {
          bgImagePath = b
          break
        }
      }
      const hasBgImage = Boolean(bgImagePath)

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

      // Smart word-boundary truncation so words are never cut in half
      const cleanVoice = scene.voice || scene.headline
      const voiceSubtitle = escapeFfmpegText(
        cleanVoice.length > 55
          ? cleanVoice.slice(0, cleanVoice.slice(0, 55).lastIndexOf(' ') || 55) + '...'
          : cleanVoice
      )

      // Multi-layer FFmpeg filtergraph:
      // 1. Background layer with continuous cinematic parallax drift
      // 2. Product Card: Padded in soft frosted container + dynamic Ken Burns scale
      // 3. Composite product card centered over background
      // 4. Top animated TikTok Progress Line (rose fill progressing from left to right)
      // 5. Top Story Beat Badge (Amber/Gold pill)
      // 6. Main Headline (Bold white with heavy black stroke - CapCut style, NO black box)
      // 7. Dynamic Voice Subtitle (High-contrast yellow with black stroke - NO black box)
      // 8. Bottom High-CTR Affiliate CTA Pill (Vibrant Rose/Red pill)
      const filterComplex = [
        // 1. Animated background with smooth multi-threaded parallax drift
        `[0:v]scale='1080*(1+${bgScaleRate}*t)':'1920*(1+${bgScaleRate}*t)':eval=frame,crop=1080:1920[bg]`,
        // 2. Product Card: Scaled inside a sleek frosted card (780x780) with dynamic Ken Burns zoom
        `[1:v]scale=740:740:force_original_aspect_ratio=decrease,pad=780:780:(ow-iw)/2:(oh-ih)/2:color=0x000000@0.25,scale='780*(1+${prodScaleRate}*t)':'780*(1+${prodScaleRate}*t)':eval=frame[prod]`,
        // 3. Composite product over background keeping center position
        `[bg][prod]overlay=(W-w)/2:460-(h-780)/2[comp]`,
        // 4. Animated TikTok Progress Line at top
        `[comp]drawbox=x=0:y=0:w='iw*t/${sceneDuration}':h=12:color=0xf43f5e@0.95:t=fill[prog]`,
        // 5. Top Story Beat Badge
        `[prog]drawtext=text='${badgeText}'${fontParam}:fontcolor=0xfacc15:fontsize=32:x=(w-text_w)/2:y=160:box=1:boxcolor=0x000000@0.75:boxborderw=14[b1]`,
        // 6. Main Headline (Bold white with heavy black stroke, CapCut style)
        `[b1]drawtext=text='${headlineEscaped}'${fontParam}:fontcolor=white:fontsize=50:borderw=6:bordercolor=black:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=240[b2]`,
        // 7. Dynamic Subtitle (Yellow punchy text with black stroke)
        `[b2]drawtext=text='${voiceSubtitle}'${fontParam}:fontcolor=0xfef08a:fontsize=36:borderw=4:bordercolor=black:shadowcolor=black@0.8:shadowx=2:shadowy=2:x=(w-text_w)/2:y=1360[b3]`,
        // 8. Bottom TikTok Shop High-CTR Pill
        `[b3]drawtext=text='🛒 GIỎ HÀNG GÓC TRÁI • XEM NGAY'${fontParam}:fontcolor=white:fontsize=36:x=(w-text_w)/2:y=1500:box=1:boxcolor=0xe11d48@0.95:boxborderw=18[out]`,
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

      try {
        await execPromise(cmd)
      } catch (segmentErr: any) {
        console.warn(
          `[VideoGenerator] Segment ${i} failed with text overlay filter:`,
          segmentErr.stderr || segmentErr.message
        )

        // Resilient Fallback: If drawtext fails due to font or environment issues, render clean Ken Burns product video
        const fallbackFilterComplex = [
          `[0:v]scale='1080*(1+${bgScaleRate}*t)':'1920*(1+${bgScaleRate}*t)':eval=frame,crop=1080:1920[bg]`,
          `[1:v]scale=740:740:force_original_aspect_ratio=decrease,pad=780:780:(ow-iw)/2:(oh-ih)/2:color=0x000000@0.25,scale='780*(1+${prodScaleRate}*t)':'780*(1+${prodScaleRate}*t)':eval=frame[prod]`,
          `[bg][prod]overlay=(W-w)/2:460-(h-780)/2[out]`,
        ].join(';')

        const fallbackCmd = [
          `"${ffmpeg}" -y`,
          bgInput,
          `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
          `-filter_complex "${fallbackFilterComplex}"`,
          `-map "[out]"`,
          `-c:v libx264 -pix_fmt yuv420p -r 30`,
          `"${segPath}"`,
        ].join(' ')

        await execPromise(fallbackCmd)
      }
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
