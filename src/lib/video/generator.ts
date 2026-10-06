import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { generateVietnameseTTS } from '@/lib/audio/tts'
import { StoryboardScene } from '@/engines/core/types'

const execPromise = promisify(exec)

// Resolve ffmpeg binary path dynamically
function getFfmpegPath(): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.3.0_supports-color@7.2.0', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      return candidate
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static')
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      return ffmpegStatic
    }
  } catch (err) {
    console.warn('[VideoGenerator] ffmpeg-static require failed:', err)
  }

  return 'ffmpeg'
}

export interface RenderVideoParams {
  productName: string
  price?: number
  scenes: StoryboardScene[]
  imageBuffer?: Buffer
  imageMimeType?: string
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
  const ffmpeg = getFfmpegPath()
  const tempDir = path.join('/tmp', 'aff-render-' + Date.now())
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    // 1. Prepare Product Image
    const inputImagePath = path.join(tempDir, 'product_input.png')
    if (params.imageBuffer && params.imageBuffer.length > 0) {
      fs.writeFileSync(inputImagePath, params.imageBuffer)
    } else {
      // Create a solid fallback image with product title
      const createImgCmd = `${ffmpeg} -y -f lavfi -i color=c=0x18181b:s=800x800:d=1 -vframes 1 "${inputImagePath}"`
      await execPromise(createImgCmd)
    }

    // 2. Generate Voiceover MP3 for each scene and track audio files
    const audioFiles: string[] = []
    for (let i = 0; i < params.scenes.length; i++) {
      const scene = params.scenes[i]
      const voiceText = scene.voice || scene.headline
      const audioBuffer = await generateVietnameseTTS(voiceText)
      const audioPath = path.join(tempDir, `voice_scene_${i}.mp3`)
      fs.writeFileSync(audioPath, audioBuffer)
      audioFiles.push(audioPath)
    }

    // 3. Concatenate all scene voiceovers into a single master voiceover track
    const concatListPath = path.join(tempDir, 'audio_concat.txt')
    const concatContent = audioFiles.map((p) => `file '${p}'`).join('\n')
    fs.writeFileSync(concatListPath, concatContent)

    const masterVoicePath = path.join(tempDir, 'master_voice.mp3')
    await execPromise(
      `${ffmpeg} -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterVoicePath}"`
    )

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
      const segPath = path.join(tempDir, `segment_${i}.mp4`)
      segmentFiles.push(segPath)

      const badgeText =
        i === 0
          ? 'HOT TIKTOK • 3S HOOK'
          : i === 1
          ? 'VAN DE THUONG GAP'
          : i === 2
          ? 'GIAI PHAP TIEN LOI'
          : i === 3
          ? 'LOI ICH SAN PHAM'
          : 'TIKTOK SHOP • MUA NGAY'

      const headlineEscaped = escapeFfmpegText(scene.headline.slice(0, 45))
      const priceText = params.price
        ? escapeFfmpegText(`Gia: ${params.price.toLocaleString('vi-VN')}d`)
        : ''

      // FFmpeg filter chain for 1080x1920:
      // Base: dark slate 1080x1920 canvas
      // Layer 1: Scaled product image centered (800x800) with slight zoom
      // Layer 2: Top Hook Pill Badge
      // Layer 3: Main Headline Box
      // Layer 4: Price / CTA Pill
      const filterComplex = [
        `[0:v]scale=1080:1920[bg]`,
        `[1:v]scale=840:840:force_original_aspect_ratio=decrease[fg]`,
        `[bg][fg]overlay=(W-w)/2:420[comp]`,
        // Top Badge
        `[comp]drawtext=text='${badgeText}'${fontParam}:fontcolor=0xfacc15:fontsize=36:x=(w-text_w)/2:y=240:box=1:boxcolor=0x000000@0.7:boxborderw=16[b1]`,
        // Headline
        `[b1]drawtext=text='${headlineEscaped}'${fontParam}:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=1340:box=1:boxcolor=0x0f172a@0.85:boxborderw=24[b2]`,
        // Bottom CTA or Price
        priceText
          ? `[b2]drawtext=text='${priceText} - Bam goc trai de xem'${fontParam}:fontcolor=0x34d399:fontsize=38:x=(w-text_w)/2:y=1480:box=1:boxcolor=0x064e3b@0.8:boxborderw=18[out]`
          : `[b2]drawtext=text='Gio hang o goc trai man hinh'${fontParam}:fontcolor=0x38bdf8:fontsize=38:x=(w-text_w)/2:y=1480:box=1:boxcolor=0x0c4a6e@0.8:boxborderw=18[out]`,
      ].join(';')

      const cmd = [
        `"${ffmpeg}" -y`,
        `-f lavfi -i color=c=0x09090b:s=1080x1920:d=3:r=30`,
        `-loop 1 -t 3 -i "${inputImagePath}"`,
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

    return {
      filePath: finalOutputPath,
      fileName: outputFileName,
      duration: 15,
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
