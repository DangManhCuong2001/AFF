import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { StoryboardScene } from '@/engines/core/types'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'
import { InfographicEngine } from '@/engines/infographic/InfographicEngine'
import { ProductCategory } from '@/engines/infographic/types'

const execPromise = promisify(exec)

export interface RenderVideoParams {
  productName: string
  price?: number
  category?: string
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
    .replace(/%/g, '%%')
}

/**
 * Smart word-wrap helper for multi-line ffmpeg drawtext
 */
function wrapText(text: string, maxCharsPerLine: number = 24): string {
  if (!text) return ''
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!currentLine) {
      currentLine = word
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.join('\n')
}

/**
 * Converts CSS hex color (#B45309) to FFmpeg color (0xB45309)
 */
function hexToFfmpegColor(hex?: string, fallback: string = '0x18181b'): string {
  if (!hex) return fallback
  const clean = hex.replace('#', '')
  if (clean.length === 6) return `0x${clean}`
  return fallback
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

    // 3. Generate Commercial Infographic Deck (100% matching Remotion Preview)
    const infographicEngine = new InfographicEngine()
    const detectedCategory = (params.category as ProductCategory) || infographicEngine.detectCategory(params.productName)
    const deck = infographicEngine.generateDeck({
      productName: params.productName || 'Sản phẩm tiện ích',
      price: params.price,
      primaryImageUrl: availableImagePaths[0] || '',
      secondaryImageUrl: availableImagePaths[1] || availableImagePaths[0],
      galleryImages: availableImagePaths,
      customCategory: detectedCategory,
      scenes: params.scenes,
    })

    const { theme, cards } = deck
    const themeAccentHex = hexToFfmpegColor(theme.accentColor, '0xf43f5e')
    const themeBadgeBgHex = hexToFfmpegColor(theme.badgeBg, '0x292524')

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
      const card = cards[i] || cards[cards.length - 1]
      const timing = segmentTimings.find((t) => t.segmentId === scene.id)
      const sceneDuration = timing ? timing.durationSec : (scene.duration && scene.duration > 0 ? scene.duration : 3)
      const segPath = path.join(tempDir, `segment_${i}.mp4`)
      segmentFiles.push(segPath)

      // Background selection based on category theme
      let bgFilename = 'minimal_lifestyle.png'
      if (theme.backgroundUrl.includes('kitchen') || theme.id === 'kitchen') {
        bgFilename = 'kitchen_modern.png'
      } else if (theme.backgroundUrl.includes('desk') || theme.id === 'desk_tech') {
        bgFilename = 'desk_workspace.png'
      } else {
        bgFilename = 'minimal_lifestyle.png'
      }

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

      // Parallax Zoom on background and product card
      const isFirstScene = i === 0
      const isLastScene = i === params.scenes.length - 1
      const bgScaleRate = isFirstScene ? 0.02 : 0.015
      const prodScaleRate = isLastScene ? 0.03 : 0.02

      // 1. Step Badge Text (e.g. "01 • GÂY CHÚ Ý", "02 • VẤN ĐỀ HAY GẶP")
      const stepBadgeText = escapeFfmpegText(`  0${card.stepNumber}  •  ${card.stepLabel}  `)

      // 2. Headline with smart wrapping
      const headlineRaw = card.headline || scene.headline || `Khám phá ${params.productName}`
      const wrappedHeadline = escapeFfmpegText(wrapText(headlineRaw, 22))

      // 3. Subtitle with smart wrapping
      const subtitleRaw = card.subtitle || scene.voice || ''
      const cleanSub = subtitleRaw.length > 60 ? subtitleRaw.slice(0, 58) + '...' : subtitleRaw
      const wrappedSubtitle = escapeFfmpegText(wrapText(cleanSub, 28))

      // Multi-layer FFmpeg filtergraph:
      // 1. Animated theme background with vignette
      // 2. Floating product card with soft drop shadow container
      // 3. Top animated TikTok Progress Line matching theme accent
      // 4. Step badge pill with theme badge background
      // 5. Main Bold Headline
      // 6. Subtitle summary
      // 7. Scene-specific overlays (Problem stickers / Feature chips / Huge Price & CTA)
      const filterComplexParts: string[] = [
        `[0:v]scale='720*(1+${bgScaleRate}*t)':'1280*(1+${bgScaleRate}*t)':eval=frame,crop=720:1280,vignette=PI/5[bg]`,
      ]

      // Product Card: Rounded container + Ken Burns drift
      const cardSize = isLastScene ? 420 : 460
      filterComplexParts.push(
        `[1:v]scale=${cardSize}:${cardSize}:force_original_aspect_ratio=decrease,pad=${cardSize + 24}:${cardSize + 24}:(ow-iw)/2:(oh-ih)/2:color=0xffffff@0.12,scale='${cardSize + 24}*(1+0.04*max(0,1-t/0.3)+${prodScaleRate}*t)':'${cardSize + 24}*(1+0.04*max(0,1-t/0.3)+${prodScaleRate}*t)':eval=frame[prod]`,
        `[bg][prod]overlay=(W-w)/2:320-(h-${cardSize + 24})/2[comp_base]`
      )

      // Top Animated TikTok Progress Bar
      filterComplexParts.push(
        `[comp_base]drawbox=x=0:y=0:w='iw*t/${sceneDuration}':h=8:color=${themeAccentHex}@0.95:t=fill[prog]`
      )

      // Top Step Badge (Circle with number + dark pill)
      filterComplexParts.push(
        `[prog]drawtext=text='${stepBadgeText}'${fontParam}:fontcolor=white:fontsize=18:x=(w-text_w)/2:y=80:box=1:boxcolor=${themeBadgeBgHex}@0.95:boxborderw=10[t_badge]`
      )

      // Main Headline
      filterComplexParts.push(
        `[t_badge]drawtext=text='${wrappedHeadline}'${fontParam}:fontcolor=white:fontsize=32:line_spacing=8:borderw=3:bordercolor=black:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=135[t_head]`
      )

      // Subtitle
      filterComplexParts.push(
        `[t_head]drawtext=text='${wrappedSubtitle}'${fontParam}:fontcolor=0xe4e4e7:fontsize=18:line_spacing=6:borderw=2:bordercolor=black:shadowcolor=black@0.5:x=(w-text_w)/2:y=235[t_sub]`
      )

      // Contextual bottom & scene layout matching InfographicMotionScene
      if (card.layoutVariant === 'problem_stickers' || (isFirstScene && card.stickers)) {
        // Problem Scene: Render real warning stickers on top of product visual
        const stk1 = escapeFfmpegText(`⚠️ ${card.stickers?.[0]?.text || scene.keywords?.[0] || 'Vấn đề phiền toái'}`)
        const stk2 = escapeFfmpegText(`⚠️ ${card.stickers?.[1]?.text || scene.keywords?.[1] || 'Bất tiện khi dùng'}`)
        filterComplexParts.push(
          `[t_sub]drawtext=text='  ${stk1}  '${fontParam}:fontcolor=0x991b1b:fontsize=20:box=1:boxcolor=0xfee2e2@0.95:boxborderw=8:x=40:y=350[stk_1]`,
          `[stk_1]drawtext=text='  ${stk2}  '${fontParam}:fontcolor=0x991b1b:fontsize=20:box=1:boxcolor=0xfee2e2@0.95:boxborderw=8:x=w-text_w-40:y=490[flash]`
        )
      } else if (isLastScene) {
        // Last Scene: Commercial Offer with huge price & TikTok Shop CTA
        const priceDisplay = card.offer?.priceNumber
          ? `${card.offer.priceNumber} ${card.offer.priceUnit || ''}`
          : params.price && params.price > 0
          ? `${params.price.toLocaleString('vi-VN')}₫`
          : 'Giá tốt hôm nay'
        const ctaText = card.offer?.ctaText || 'XEM NGAY Ở GIỎ HÀNG GÓC TRÁI'
        filterComplexParts.push(
          `[t_sub]drawtext=text='  ${escapeFfmpegText(priceDisplay)}  '${fontParam}:fontcolor=0xfbbf24:fontsize=36:borderw=2:bordercolor=black:box=1:boxcolor=0x09090b@0.85:boxborderw=12:x=(w-text_w)/2:y=780[t_price]`,
          `[t_price]drawtext=text='  Voucher giảm giá TikTok Shop • Freeship toàn quốc  '${fontParam}:fontcolor=0x34d399:fontsize=18:box=1:boxcolor=0x09090b@0.75:boxborderw=8:x=(w-text_w)/2:y=840[t_vouch]`,
          `[t_vouch]drawtext=text='  🛒 ${escapeFfmpegText(ctaText)}  '${fontParam}:fontcolor=white:fontsize=22:box=1:boxcolor=0xe11d48@0.95:boxborderw=16:x=(w-text_w)/2:y='895+3*sin(3*PI*t)'[flash]`
        )
      } else {
        // Feature/Demo/Benefit Scenes: Real feature chips row matching preview
        let chipsStr = ''
        if (card.featureChips && card.featureChips.length > 0) {
          chipsStr = card.featureChips.map((c) => `✓ ${c.title}`).join('    ')
        } else if (scene.keywords && scene.keywords.length > 0) {
          chipsStr = scene.keywords.map((k) => `✓ ${k}`).join('    ')
        } else {
          chipsStr = '✓ Tiện lợi    ✓ Cao cấp    ✓ Đáng tiền'
        }
        filterComplexParts.push(
          `[t_sub]drawtext=text='  ${escapeFfmpegText(chipsStr)}  '${fontParam}:fontcolor=white:fontsize=20:box=1:boxcolor=${themeAccentHex}@0.9:boxborderw=12:x=(w-text_w)/2:y=830[flash]`
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
        `-c:v libx264 -preset veryfast -crf 27 -maxrate 2200k -bufsize 4400k -pix_fmt yuv420p -r 30`,
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
          `-c:v libx264 -preset veryfast -crf 27 -maxrate 2200k -bufsize 4400k -pix_fmt yuv420p -r 30`,
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
