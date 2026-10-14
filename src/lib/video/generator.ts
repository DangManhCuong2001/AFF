import type { VoiceProvider } from '@/lib/audio/provider'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { StoryboardScene } from '@/engines/core/types'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'
import { InfographicEngine, THEMES } from '@/engines/infographic/InfographicEngine'
import { ProductCategory } from '@/engines/infographic/types'
import { getGuaranteedFontPath } from '@/lib/video/font-helper'

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
  voiceProvider?: VoiceProvider
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
      const speechAudioResult = await ttsProvider.generateSpeech(speechPlan, { provider: params.voiceProvider })
      fs.writeFileSync(masterVoicePath, speechAudioResult.audioBuffer)
      masterAudioDuration = speechAudioResult.durationSec
      segmentTimings = speechAudioResult.segmentTimings
    }

    // 3. Generate Commercial Infographic Deck (100% matching Remotion Preview)
    const infographicEngine = new InfographicEngine()
    const detectedCategory = infographicEngine.detectCategory(params.productName)
    const deck = infographicEngine.generateDeck({
      productName: params.productName || 'Sản phẩm tiện ích',
      price: params.price,
      primaryImageUrl: availableImagePaths[0] || '',
      secondaryImageUrl: availableImagePaths[1] || availableImagePaths[0],
      galleryImages: availableImagePaths,
      customCategory: (params.category as ProductCategory) || detectedCategory,
      scenes: params.scenes,
    })

    const theme = deck.theme || (THEMES[detectedCategory as ProductCategory] || THEMES.kitchen)
    const cards = deck.cards || []
    const themeAccentHex = hexToFfmpegColor(theme?.accentColor, '0xB45309')
    const themeBadgeBgHex = hexToFfmpegColor(theme?.badgeBg, '0x292524')
    const themeSurfaceBgHex = hexToFfmpegColor(theme?.surfaceBg, '0xFAF8F5')
    const themeTextPrimaryHex = hexToFfmpegColor(theme?.textPrimary, '0x1C1917')
    const themeTextSecondaryHex = hexToFfmpegColor(theme?.textSecondary, '0x57534E')
    const themeBorderHex = hexToFfmpegColor(theme?.borderColor, '0xE7E5E4')

    // 4. Build Video Segments with guaranteed font resolution and full 1080x1920 canvas
    const segmentFiles: string[] = []
    const fontPath = getGuaranteedFontPath()
    const fontParam = fontPath ? `:fontfile='${fontPath}'` : ''

    for (let i = 0; i < params.scenes.length; i++) {
      const scene = params.scenes[i]
      const card = cards[i] || cards[cards.length - 1]
      const timing = segmentTimings.find((t) => t.segmentId === scene.id)
      const sceneDuration = timing ? timing.durationSec : (scene.duration && scene.duration > 0 ? scene.duration : 3)
      const segPath = path.join(tempDir, `segment_${i}.mp4`)
      segmentFiles.push(segPath)

      const sceneImgPath = availableImagePaths[scene.renderPlan?.assetIndex ?? (i % availableImagePaths.length)] || availableImagePaths[0]
      const isFirstScene = i === 0
      const isLastScene = i === params.scenes.length - 1

      // 1. Step Badge Text (e.g. "01 • GÂY CHÚ Ý", "02 • VẤN ĐỀ HAY GẶP")
      const stepBadgeText = escapeFfmpegText(`   0${card.stepNumber}  •  ${card.stepLabel}   `)

      // 2. Headline with smart wrapping
      const headlineRaw = card.headline || scene.headline || `Khám phá ${params.productName}`
      const wrappedHeadline = escapeFfmpegText(wrapText(headlineRaw, 22))

      // 3. Subtitle with smart wrapping
      const subtitleRaw = card.subtitle || scene.voice || ''
      const cleanSub = subtitleRaw.length > 60 ? subtitleRaw.slice(0, 58) + '...' : subtitleRaw
      const wrappedSubtitle = escapeFfmpegText(wrapText(cleanSub, 28))

      // Commercial Infographic Layout Pipeline (Exact 1080x1920 matching Remotion):
      // 1. Clean theme surface background plate
      // 2. Outer decorative border
      // 3. Top animated progress bar matching theme accent
      // 4. Step badge pill in theme badge background
      // 5. Main dark bold headline
      // 6. Subtitle summary
      // 7. Middle pristine white card stage with product image & Ken Burns zoom
      // 8. Layout variant specific overlays (Problem stickers / Feature chips / Huge Price & CTA)
      const filterComplexParts: string[] = [
        `[0:v]drawbox=x=24:y=24:w=1032:h=1872:color=${themeBorderHex}:t=3[bg_frame]`,
        `[bg_frame]drawbox=x=0:y=0:w='iw*t/${sceneDuration}':h=12:color=${themeAccentHex}:t=fill[bg_prog]`,
      ]

      // Step Badge
      filterComplexParts.push(
        `[bg_prog]drawtext=text='${stepBadgeText}'${fontParam}:fontcolor=white:fontsize=26:x=72:y=90:box=1:boxcolor=${themeBadgeBgHex}:boxborderw=14[t_badge]`
      )

      // Main Headline (Dark bold typography matching Remotion 1080x1920)
      filterComplexParts.push(
        `[t_badge]drawtext=text='${wrappedHeadline}'${fontParam}:fontcolor=${themeTextPrimaryHex}:fontsize=50:line_spacing=12:x=72:y=180[t_head]`
      )

      // Subtitle (Secondary charcoal text matching Remotion 1080x1920)
      filterComplexParts.push(
        `[t_head]drawtext=text='${wrappedSubtitle}'${fontParam}:fontcolor=${themeTextSecondaryHex}:fontsize=28:line_spacing=8:x=72:y=330[t_sub]`
      )

      // White Product Stage Card Container (936x840/930 at 1080x1920)
      const stageW = 936
      const stageH = isLastScene ? 840 : 930
      const stageX = 72
      const stageY = 420
      filterComplexParts.push(
        `[t_sub]drawbox=x=${stageX}:y=${stageY}:w=${stageW}:h=${stageH}:color=white:t=fill[stage_bg]`,
        `[stage_bg]drawbox=x=${stageX}:y=${stageY}:w=${stageW}:h=${stageH}:color=${themeBorderHex}:t=3[stage_border]`,
        `[1:v]scale=${stageW - 90}:${stageH - 90}:force_original_aspect_ratio=decrease,scale='iw*(1+0.04*t)':'ih*(1+0.04*t)':eval=frame[prod_scaled]`,
        `[stage_border][prod_scaled]overlay=${stageX}+(${stageW}-w)/2:${stageY}+(${stageH}-h)/2[stage_comp]`
      )

      // Contextual layout variant overlays matching InfographicMotionScene
      if (card.layoutVariant === 'problem_stickers' || (isFirstScene && card.stickers)) {
        // Problem Scene: Warning Problem Stickers
        const stk1 = escapeFfmpegText(card.stickers?.[0]?.text || scene.keywords?.[0] || 'Vấn đề phiền toái')
        const stk2 = escapeFfmpegText(card.stickers?.[1]?.text || scene.keywords?.[1] || 'Bất tiện khi dùng')
        filterComplexParts.push(
          `[stage_comp]drawtext=text='   ${stk1}   '${fontParam}:fontcolor=0x991B1B:fontsize=30:box=1:boxcolor=0xFEE2E2:boxborderw=12:x=110:y=${stageY + 80}[stk_1]`,
          `[stk_1]drawtext=text='   ${stk2}   '${fontParam}:fontcolor=0x991B1B:fontsize=30:box=1:boxcolor=0xFEE2E2:boxborderw=12:x=w-text_w-110:y=${stageY + 300}[stk_2]`,
          `[stk_2]drawtext=text='   Khám phá giải pháp mới tiện ích   '${fontParam}:fontcolor=white:fontsize=26:box=1:boxcolor=${themeBadgeBgHex}:boxborderw=16:x=(w-text_w)/2:y=1440[flash]`
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
          `[stage_comp]drawtext=text='${escapeFfmpegText(priceDisplay)}'${fontParam}:fontcolor=${themeAccentHex}:fontsize=76:x=(w-text_w)/2:y=1330[t_price]`,
          `[t_price]drawtext=text='* Giá ưu đãi độc quyền hôm nay trên TikTok Shop'${fontParam}:fontcolor=${themeTextSecondaryHex}:fontsize=24:x=(w-text_w)/2:y=1440[t_note]`,
          `[t_note]drawtext=text='   ${escapeFfmpegText(ctaText)}   '${fontParam}:fontcolor=white:fontsize=36:box=1:boxcolor=${themeAccentHex}:boxborderw=24:x=(w-text_w)/2:y='1510+5*sin(3*PI*t)'[flash]`
        )
      } else {
        // Feature/Demo/Benefit Scenes: Feature Chips
        let chipsStr = ''
        if (card.featureChips && card.featureChips.length > 0) {
          chipsStr = card.featureChips.map((c) => c.title).join('   •   ')
        } else if (scene.keywords && scene.keywords.length > 0) {
          chipsStr = scene.keywords.map((k) => k).join('   •   ')
        } else {
          chipsStr = 'Tiện lợi   •   Cao cấp   •   Đáng tiền'
        }
        filterComplexParts.push(
          `[stage_comp]drawtext=text='   ${escapeFfmpegText(chipsStr)}   '${fontParam}:fontcolor=white:fontsize=30:box=1:boxcolor=${themeBadgeBgHex}:boxborderw=20:x=(w-text_w)/2:y=1440[flash]`
        )
      }

      // Smooth white flash transition between scenes
      filterComplexParts.push(`[flash]fade=t=in:st=0:d=0.10:color=white[out]`)

      const filterComplex = filterComplexParts.join(';')

      const bgInput = `-f lavfi -i color=c=${themeSurfaceBgHex}:s=1080x1920:d=${sceneDuration}:r=30`

      const cmd = [
        `"${ffmpeg}" -y`,
        bgInput,
        `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
        `-filter_complex "${filterComplex}"`,
        `-map "[out]"`,
        `-c:v libx264 -preset veryfast -crf 23 -maxrate 4500k -bufsize 9000k -pix_fmt yuv420p -r 30`,
        `"${segPath}"`,
      ].join(' ')

      try {
        await execPromise(cmd)
      } catch (segmentErr: unknown) {
        console.warn(
          `[VideoGenerator] Segment ${i} failed with text overlay filter:`,
          segmentErr instanceof Error ? segmentErr.message : String(segmentErr)
        )

        // Resilient Fallback: If drawtext fails, render 1080x1920 Ken Burns product video
        const fallbackFilterComplex = [
          `[0:v]scale='1080*(1+0.02*t)':'1920*(1+0.02*t)':eval=frame,crop=1080:1920[bg]`,
          `[1:v]scale=750:750:force_original_aspect_ratio=decrease,pad=780:780:(ow-iw)/2:(oh-ih)/2:color=0x000000@0.25,scale='780*(1+0.07*max(0,1-t/0.35)+0.03*t)':'780*(1+0.07*max(0,1-t/0.35)+0.03*t)':eval=frame[prod]`,
          `[bg][prod]overlay=(W-w)/2:460-(h-780)/2,fade=t=in:st=0:d=0.12:color=white[out]`,
        ].join(';')

        const fallbackCmd = [
          `"${ffmpeg}" -y`,
          bgInput,
          `-loop 1 -t ${sceneDuration} -i "${sceneImgPath}"`,
          `-filter_complex "${fallbackFilterComplex}"`,
          `-map "[out]"`,
          `-c:v libx264 -preset veryfast -crf 23 -maxrate 4500k -bufsize 9000k -pix_fmt yuv420p -r 30`,
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
