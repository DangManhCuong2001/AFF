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
    const fontPath = fs.existsSync('/System/Library/Fonts/Supplemental/Arial.ttf')
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

      const badgeText =
        i === 0
          ? 'HOT TIKTOK • 3S HOOK'
          : i === params.scenes.length - 1
          ? 'TIKTOK SHOP • MUA NGAY'
          : scene.type === 'problem'
          ? 'VAN DE THUONG GAP'
          : scene.type === 'demo'
          ? 'GIAI PHAP TIEN LOI'
          : scene.type === 'benefit'
          ? 'LOI ICH SAN PHAM'
          : 'TIEN ICH GIA DINH'

      const headlineEscaped = escapeFfmpegText(scene.headline.slice(0, 42))
      const voiceSubtitle = escapeFfmpegText((scene.voice || scene.headline).slice(0, 55))
      const emphasisWord = (scene.keywords && scene.keywords[0]) ? escapeFfmpegText(scene.keywords[0].slice(0, 20).toUpperCase()) : ''

      // FFmpeg filter chain for 1080x1920:
      // Base: dark slate 1080x1920 canvas
      // Layer 1: Scaled product image centered (840x840)
      // Layer 2: Top Story Beat Badge (Amber/Yellow)
      // Layer 3: Main Headline Box (Slate/Dark)
      // Layer 4: Voice Subtitle Box (White with dark backdrop)
      // Layer 5: Affiliate CTA Pill (Cyan/Teal - No direct price)
      const filterComplex = [
        `[0:v]scale=1080:1920[bg]`,
        `[1:v]scale=840:840:force_original_aspect_ratio=decrease[fg]`,
        `[bg][fg]overlay=(W-w)/2:400[comp]`,
        // Top Story Beat Badge
        `[comp]drawtext=text='${badgeText}'${fontParam}:fontcolor=0xfacc15:fontsize=36:x=(w-text_w)/2:y=220:box=1:boxcolor=0x000000@0.7:boxborderw=16[b1]`,
        // Main Headline
        `[b1]drawtext=text='${headlineEscaped}'${fontParam}:fontcolor=white:fontsize=46:x=(w-text_w)/2:y=1300:box=1:boxcolor=0x0f172a@0.9:boxborderw=20[b2]`,
        // Subtitle line
        `[b2]drawtext=text='${voiceSubtitle}'${fontParam}:fontcolor=0xf1f5f9:fontsize=32:x=(w-text_w)/2:y=1400:box=1:boxcolor=0x000000@0.6:boxborderw=14[b3]`,
        // Bottom CTA Pill
        `[b3]drawtext=text='Xem gia uu dai tai gio hang goc trai'${fontParam}:fontcolor=0x38bdf8:fontsize=36:x=(w-text_w)/2:y=1510:box=1:boxcolor=0x0c4a6e@0.85:boxborderw=18[out]`,
      ].join(';')

      const sceneImgPath = availableImagePaths[i % availableImagePaths.length]

      const cmd = [
        `"${ffmpeg}" -y`,
        `-f lavfi -i color=c=0x09090b:s=1080x1920:d=${sceneDuration}:r=30`,
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

    // 6. Final Mix: Combine Video + Master Voice + Background Track into final MP4
    const outputFileName = `product_video_${Date.now()}.mp4`
    const outputDir = path.join(process.cwd(), 'public', 'renders')
    fs.mkdirSync(outputDir, { recursive: true })
    const finalOutputPath = path.join(outputDir, outputFileName)

    const bgmPath = path.join(process.cwd(), 'public', 'music', 'lofi-beat.aac')
    const hasBgm = fs.existsSync(bgmPath)

    let finalCmd: string
    if (hasBgm) {
      // Audio Ducking: Voice at volume 1.0, BGM at volume 0.15
      finalCmd = [
        `"${ffmpeg}" -y`,
        `-i "${rawCombinedVideoPath}"`,
        `-i "${masterVoicePath}"`,
        `-stream_loop -1 -i "${bgmPath}"`,
        `-filter_complex "[1:a]volume=1.2[v];[2:a]volume=0.18[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2[aout]"`,
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
