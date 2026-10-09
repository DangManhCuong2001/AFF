import fs from 'fs'
import path from 'path'
import os from 'os'
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
  masterAudioBuffer?: Buffer
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
  const tempDir = path.join(os.tmpdir(), 'aff-render-' + Date.now())
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
      const createImgCmd = `"${ffmpeg}" -y -f lavfi -i color=c=0x18181b:s=800x800:d=1 -vframes 1 "${fallbackPath}"`
      await execPromise(createImgCmd)
      availableImagePaths.push(fallbackPath)
    }

    // 2. Audio-First Timeline: Reuse provided Master Audio Buffer OR synthesize with VipeeSpeechDirector
    let masterAudioDuration = 0
    let segmentTimings: Array<{ segmentId: string; startSec: number; endSec: number; durationSec: number }> = []
    const masterVoicePath = path.join(tempDir, 'master_voice.mp3')

    if (params.masterAudioBuffer && params.masterAudioBuffer.length > 0) {
      console.log('[VideoGenerator] Reusing pre-generated master audio buffer, skipping server TTS synthesis.')
      fs.writeFileSync(masterVoicePath, params.masterAudioBuffer)
      let cur = 0
      segmentTimings = params.scenes.map((s, idx) => {
        const dur = s.duration && s.duration > 0 ? s.duration : 3
        const t = {
          segmentId: s.id || `scene-${idx + 1}`,
          startSec: cur,
          endSec: cur + dur,
          durationSec: dur,
        }
        cur += dur
        return t
      })
      masterAudioDuration = cur
    } else {
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
      fs.writeFileSync(masterVoicePath, speechAudioResult.audioBuffer)
      masterAudioDuration = speechAudioResult.durationSec
      segmentTimings = speechAudioResult.segmentTimings
    }

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
      const timing = segmentTimings.find((t) => t.segmentId === scene.id)
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
      const prodScaleRate = i === 0 ? 0.04 : i === 2 ? 0.045 : i === 3 ? 0.03 : 0.02

      const isFirstScene = i === 0
      const isLastScene = i === params.scenes.length - 1
      const isRevealScene = i === 1
      const isBenefitScene = i === 2

      const benefitChipsText = escapeFfmpegText('✓ Tiện lợi    ✓ Gọn gàng    ✓ Bền đẹp')

      // Context-aware scene label
      const sceneLabel = escapeFfmpegText(
        isFirstScene
          ? 'VẤN ĐỀ HAY GẶP'
          : isLastScene
          ? 'TIKTOK SHOP ƯU ĐÃI'
          : isRevealScene
          ? 'GIẢI PHÁP MỚI'
          : isBenefitScene
          ? 'CHI TIẾT TIỆN LỢI'
          : 'KẾT QUẢ THỎA MÃN'
      )

      // Smart word-boundary truncation so words are never cut in half
      const cleanVoice = scene.voice || scene.headline
      const voiceSubtitle = escapeFfmpegText(
        cleanVoice.length > 50
          ? cleanVoice.slice(0, cleanVoice.slice(0, 50).lastIndexOf(' ') || 50) + '...'
          : cleanVoice
      )

      // Multi-layer FFmpeg filtergraph:
      // 1. Background layer with continuous cinematic parallax drift & vignette
      // 2. Product Card: Rounded frosted container + dynamic Ken Burns scale (hidden in scene 1)
      // 3. Composite product card centered over background
      // 4. Top animated TikTok Progress Line
      // 5. Top Context Label (small, uppercase, low emphasis)
      // 6. Main Headline (Bold white with soft shadow, high emphasis)
      // 7. Middle / Bottom: Benefit Chips or Clean Offer CTA
      const filterComplexParts: string[] = [
        // 1. Animated background
        `[0:v]scale='720*(1+${bgScaleRate}*t)':'1280*(1+${bgScaleRate}*t)':eval=frame,crop=720:1280,vignette=PI/5[bg]`,
      ]

      if (isFirstScene) {
        // Scene 1: Problem focus - NO giant product card yet! Gives breathing room.
        filterComplexParts.push(
          `[bg]drawtext=text='⚠️ Dễ ẩm mốc • Khó lấy thìa • Bừa bộn gian bếp':fontcolor=0xfda4af:fontsize=20:x=(w-text_w)/2:y=560:box=1:boxcolor=0x09090b@0.75:boxborderw=16[comp]`
        )
      } else {
        // Scenes 2+: Product card in soft frosted container
        const cardSize = isLastScene ? 400 : 460
        filterComplexParts.push(
          `[1:v]scale=${cardSize}:${cardSize}:force_original_aspect_ratio=decrease,pad=${cardSize + 20}:${cardSize + 20}:(ow-iw)/2:(oh-ih)/2:color=0xffffff@0.08,scale='${cardSize + 20}*(1+0.04*max(0,1-t/0.3)+${prodScaleRate}*t)':'${cardSize + 20}*(1+0.04*max(0,1-t/0.3)+${prodScaleRate}*t)':eval=frame[prod]`,
          `[bg][prod]overlay=(W-w)/2:300-(h-${cardSize + 20})/2[comp]`
        )
      }

      // Top progress line
      filterComplexParts.push(
        `[comp]drawbox=x=0:y=0:w='iw*t/${sceneDuration}':h=6:color=0xf43f5e@0.95:t=fill[prog]`
      )

      // Top Context Label
      filterComplexParts.push(
        `[prog]drawtext=text='${sceneLabel}'${fontParam}:fontcolor=0xfbbf24:fontsize=18:x=(w-text_w)/2:y=110:box=1:boxcolor=0x09090b@0.65:boxborderw=8[t_label]`
      )

      // Main Headline
      filterComplexParts.push(
        `[t_label]drawtext=text='${headlineEscaped}'${fontParam}:fontcolor=white:fontsize=32:borderw=3:bordercolor=black:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=165[t_head]`
      )

      // Contextual bottom layout
      if (isLastScene) {
        // Offer + Clean CTA
        const priceDisplay = params.price && params.price > 0
          ? `${params.price.toLocaleString('vi-VN')}₫`
          : '39K / bộ'
        filterComplexParts.push(
          `[t_head]drawtext=text='${escapeFfmpegText(priceDisplay)} • Voucher giảm 10K'${fontParam}:fontcolor=0xfbbf24:fontsize=22:x=(w-text_w)/2:y=800:box=1:boxcolor=0x09090b@0.8:boxborderw=10[t_offer]`,
          `[t_offer]drawtext=text='🛒 XEM Ở GIỎ HÀNG GÓC TRÁI'${fontParam}:fontcolor=white:fontsize=22:x=(w-text_w)/2:y='880+3*sin(3*PI*t)':box=1:boxcolor=0xe11d48@0.95:boxborderw=14[flash]`
        )
      } else if (!isFirstScene) {
        // Benefit chips row below product card
        filterComplexParts.push(
          `[t_head]drawtext=text='${benefitChipsText}'${fontParam}:fontcolor=0x34d399:fontsize=20:x=(w-text_w)/2:y=830:box=1:boxcolor=0x09090b@0.7:boxborderw=10[flash]`
        )
      } else {
        // Problem scene subtitle
        filterComplexParts.push(
          `[t_head]drawtext=text='${voiceSubtitle}'${fontParam}:fontcolor=0xe4e4e7:fontsize=20:borderw=2:bordercolor=black:x=(w-text_w)/2:y=830[flash]`
        )
      }

      // Smooth white flash entrance transition
      filterComplexParts.push(`[flash]fade=t=in:st=0:d=0.10:color=white[out]`)

      const filterComplex = filterComplexParts.join(';')

      const bgInput = hasBgImage
        ? `-loop 1 -t ${sceneDuration} -i "${bgImagePath}"`
        : `-f lavfi -i color=c=0x18181b:s=720x1280:d=${sceneDuration}:r=30`

      const cmd = [
        `"${ffmpeg}" -y`,
        bgInput,
        `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
        `-filter_complex "${filterComplex}"`,
        `-map "[out]"`,
        `-c:v libx264 -preset ultrafast -tune fastdecode -crf 26 -pix_fmt yuv420p -r 30`,
        `"${segPath}"`,
      ].join(' ')

      try {
        await execPromise(cmd)
      } catch (segmentErr: unknown) {
        console.warn(
          `[VideoGenerator] Segment ${i} failed with text overlay filter:`,
          segmentErr instanceof Error ? segmentErr.message : String(segmentErr)
        )

        // Resilient Fallback: If drawtext fails due to font or environment issues, render clean Ken Burns product video
        const fallbackFilterComplex = [
          `[0:v]scale='720*(1+${bgScaleRate}*t)':'1280*(1+${bgScaleRate}*t)':eval=frame,crop=720:1280[bg]`,
          `[1:v]scale=500:500:force_original_aspect_ratio=decrease,pad=520:520:(ow-iw)/2:(oh-ih)/2:color=0x000000@0.25,scale='520*(1+0.07*max(0,1-t/0.35)+${prodScaleRate}*t)':'520*(1+0.07*max(0,1-t/0.35)+${prodScaleRate}*t)':eval=frame[prod]`,
          `[bg][prod]overlay=(W-w)/2:310-(h-520)/2,fade=t=in:st=0:d=0.12:color=white[out]`,
        ].join(';')

        const fallbackCmd = [
          `"${ffmpeg}" -y`,
          bgInput,
          `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
          `-filter_complex "${fallbackFilterComplex}"`,
          `-map "[out]"`,
          `-c:v libx264 -preset ultrafast -tune fastdecode -crf 26 -pix_fmt yuv420p -r 30`,
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
      `"${ffmpeg}" -y -f concat -safe 0 -i "${videoConcatListPath}" -c copy "${rawCombinedVideoPath}"`
    )

    // 6. Final Sound Design: Combine Video + Master Voice + Synced SFX + Ducked BGM into final MP4
    const outputFileName = `product_video_${Date.now()}.mp4`
    const tmpRendersDir = path.join(os.tmpdir(), 'renders')
    fs.mkdirSync(tmpRendersDir, { recursive: true })
    const finalOutputPath = path.join(tmpRendersDir, outputFileName)

    const bgmCandidates = [
      path.join(process.cwd(), 'src', 'assets', 'music', 'lofi-beat.aac'),
      path.join(process.cwd(), 'public', 'music', 'lofi-beat.aac'),
    ]
    const bgmPath = bgmCandidates.find((p) => fs.existsSync(p)) || ''

    const whooshCandidates = [
      path.join(process.cwd(), 'src', 'assets', 'sfx', 'whoosh.mp3'),
      path.join(process.cwd(), 'public', 'sfx', 'whoosh.mp3'),
    ]
    const whooshPath = whooshCandidates.find((p) => fs.existsSync(p)) || ''

    const hasBgm = Boolean(bgmPath)
    const hasWhoosh = Boolean(whooshPath)

    let finalCmd: string
    if (hasBgm) {
      // Clean mix: Voice at volume 1.3, BGM ducked at 0.12 (no harsh SFX artifacts)
      finalCmd = [
        `"${ffmpeg}" -y`,
        `-i "${rawCombinedVideoPath}"`,
        `-i "${masterVoicePath}"`,
        `-stream_loop -1 -i "${bgmPath}"`,
        `-filter_complex "[1:a]volume=1.3[v];[2:a]volume=0.12[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2[aout]"`,
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

    // Best-effort mirror to public/renders for local development (safe on read-only environments)
    try {
      const publicDir = path.join(process.cwd(), 'public', 'renders')
      fs.mkdirSync(publicDir, { recursive: true })
      fs.copyFileSync(finalOutputPath, path.join(publicDir, outputFileName))
    } catch {
      // Ignore EROFS on read-only serverless filesystems like Vercel
    }

    const stats = fs.statSync(finalOutputPath)

    const totalDuration = masterAudioDuration || params.scenes.reduce(
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
