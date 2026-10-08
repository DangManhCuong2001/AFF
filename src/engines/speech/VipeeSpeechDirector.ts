import { EmotionalTone } from '@/engines/creative/types'
import {
  AudioResult,
  SpeechDirector,
  SpeechPlan,
  SpeechSegment,
  TTSProvider,
  TTSProviderCapabilities,
  VoicePersonality,
} from './types'
import https from 'https'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'
import { sanitizeTextForTTS } from '@/lib/audio/tts'
import { EdgeTTS } from 'node-edge-tts'

const execPromise = promisify(exec)

export class VipeeSpeechDirector implements SpeechDirector {
  /**
   * Phonetic mapping dictionary for natural spoken Vietnamese
   */
  private static PHONETIC_MAP: Record<string, string> = {
    '3m': 'ba mờ',
    '3k': 'ba nghìn',
    '39k': 'ba mươi chín nghìn',
    '50k': 'năm mươi nghìn',
    '89k': 'tám mươi chín nghìn',
    '99k': 'chín mươi chín nghìn',
    '150k': 'một trăm năm mươi nghìn',
    silicon: 'si li côn',
    silicone: 'si li côn',
    typec: 'típ xi',
    'type-c': 'típ xi',
    usb: 'u ét bê',
    set: 'sét',
    setup: 'sét ắp',
    deal: 'điu',
    voucher: 'vou chơ',
    freeship: 'phi síp',
    pov: 'pê ô vê',
    organizer: 'ooc ga nai dơ',
    gadget: 'gát dét',
    review: 'ri viu',
  }

  /**
   * Creates an emotionally modulated, spoken-rhythm SpeechPlan
   */
  createSpeechPlan(
    storyScript: {
      scenes: Array<{
        id: string
        voice: string
        storyBeat: string
        emphasisWords?: string[]
        targetDuration?: number
      }>
    },
    options?: {
      voicePreset?: VoicePersonality
    }
  ): SpeechPlan {
    const voicePreset = options?.voicePreset || 'Natural Friend'
    const segments: SpeechSegment[] = []
    let totalEstimatedDuration = 0

    const intentMap: Record<string, import('./types').SpeechIntent> = {
      hook: 'hook',
      problem: 'annoyed',
      tension: 'annoyed',
      relatable: 'relatable',
      curiosity: 'curious',
      reveal: 'reveal',
      solution: 'reveal',
      product_hero: 'reveal',
      demo: 'satisfied',
      mechanism: 'satisfied',
      benefit: 'satisfied',
      payoff: 'satisfied',
      offer: 'offer',
      cta: 'cta',
    }

    const emotionMap: Record<string, EmotionalTone> = {
      hook: 'curiosity',
      problem: 'relatable_frustration',
      tension: 'annoyance',
      reveal: 'interest',
      product_hero: 'interest',
      demo: 'confidence',
      mechanism: 'confidence',
      benefit: 'satisfaction',
      payoff: 'satisfaction',
      offer: 'friendly_urgency',
      cta: 'friendly_urgency',
    }

    const paceMap: Record<VoicePersonality, Record<string, number>> = {
      'Natural Friend': { hook: 0.96, problem: 0.94, reveal: 0.92, demo: 0.98, payoff: 0.92, cta: 0.96 },
      'Warm Reviewer': { hook: 0.92, problem: 0.90, reveal: 0.90, demo: 0.94, payoff: 0.90, cta: 0.94 },
      'Curious Tester': { hook: 1.02, problem: 0.98, reveal: 0.95, demo: 1.00, payoff: 0.94, cta: 0.98 },
      'Energetic Seller': { hook: 1.05, problem: 1.00, reveal: 1.02, demo: 1.05, payoff: 1.00, cta: 1.06 },
      'Calm Explainer': { hook: 0.90, problem: 0.88, reveal: 0.88, demo: 0.90, payoff: 0.88, cta: 0.90 },
    }

    for (let i = 0; i < storyScript.scenes.length; i++) {
      const s = storyScript.scenes[i]
      const rawVoice = s.voice || ''
      const beat = s.storyBeat || (i === 0 ? 'hook' : i === storyScript.scenes.length - 1 ? 'cta' : 'demo')
      const intent = intentMap[beat] || 'relatable'
      const emotion = emotionMap[beat] || 'interest'
      const pace = paceMap[voicePreset][beat] || 0.95

      // Clean spoken text and normalize pronunciation
      const spokenText = this.humanizeSpokenVietnamese(rawVoice)
      const ttsScript = this.generateTTSScript(spokenText)

      // Calculate natural breath pauses
      const pauseBeforeMs = i === 0 ? 50 : beat === 'reveal' ? 250 : 100
      const pauseAfterMs = beat === 'hook' ? 350 : beat === 'reveal' ? 300 : beat === 'payoff' ? 400 : 250

      // Word count estimated duration (Vietnamese average: ~3.5 to 4.2 words per second at normal pace)
      const wordCount = spokenText.split(/\s+/).filter(Boolean).length
      const estimatedSec = Math.max(2.0, (wordCount / (3.8 * pace)) + (pauseAfterMs / 1000))
      totalEstimatedDuration += estimatedSec

      const emphasisWords = s.emphasisWords || this.extractKeyEmphasisWords(spokenText)

      segments.push({
        id: s.id || `seg-${i + 1}`,
        text: spokenText,
        intent,
        displayScript: rawVoice,
        ttsScript,
        emotion,
        pace,
        energy: beat === 'hook' || beat === 'cta' ? 0.85 : beat === 'problem' ? 0.6 : 0.75,
        pauseBeforeMs,
        pauseAfterMs,
        emphasisWords,
        emphasis: emphasisWords,
        estimatedDurationSec: Number(estimatedSec.toFixed(2)),
      })
    }

    return {
      voicePreset,
      segments,
      totalEstimatedDurationSec: Number(totalEstimatedDuration.toFixed(2)),
    }
  }

  /**
   * Humanizes sentences into natural spoken Vietnamese phrasing with emotional particles
   */
  private humanizeSpokenVietnamese(text: string): string {
    let t = text.trim()
    // Replace rigid presentation/catalog phrases with authentic spoken phrases
    t = t.replace(/Sản phẩm sở hữu thiết kế/gi, 'Nhìn thiết kế')
    t = t.replace(/giúp tối ưu không gian/gi, 'góc nhà gọn hơn hẳn luôn')
    t = t.replace(/được trang bị/gi, 'có sẵn')
    t = t.replace(/phù hợp với nhiều không gian/gi, 'để ở đâu cũng tiện')
    t = t.replace(/kích thước nhỏ gọn/gi, 'nhỏ xíu mà tiện cực kỳ')
    t = t.replace(/mang lại cảm giác/gi, 'thấy')
    t = t.replace(/đây là giải pháp/gi, 'may mà mình kiếm được cái này')
    t = t.replace(/sau khi sử dụng/gi, 'dùng xong cái là')
    t = t.replace(/mang lại hiệu quả/gi, 'đỡ bực hẳn')
    t = t.replace(/giúp bạn tiết kiệm thời gian/gi, 'đỡ mất công mò mẫm')
    t = t.replace(/hãy bấm vào/gi, 'mọi người xem ở')
    t = t.replace(/được thiết kế để/gi, 'dùng để')
    t = t.replace(/đảm bảo chất lượng/gi, 'dùng ưng cái bụng luôn')

    // Ensure ending with lively punctuation rather than flat period
    if (t.endsWith('.')) {
      t = t.slice(0, -1) + '!'
    }
    return t
  }

  /**
   * Converts display text into pronunciation-friendly script for Vietnamese TTS
   */
  private generateTTSScript(text: string): string {
    let tts = text.toLowerCase()

    for (const [key, val] of Object.entries(VipeeSpeechDirector.PHONETIC_MAP)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      tts = tts.replace(regex, val)
    }

    // Add punctuation micro-pauses for natural breath and intonation:
    tts = tts.replace(/\.\.\./g, '... ')
    tts = tts.replace(/([,;])/g, '$1 ')
    return tts.trim()
  }

  /**
   * Extracts punchy words for visual emphasis sync
   */
  private extractKeyEmphasisWords(text: string): string[] {
    const keywords: string[] = []
    const words = text.split(/\s+/)
    for (const w of words) {
      const clean = w.replace(/[^a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '')
      if (['khó chịu', 'bực', 'bừa', 'ngăn nắp', 'gọn', 'thông minh', 'rơi', 'nắp bật', 'tiện'].includes(clean.toLowerCase())) {
        keywords.push(clean)
      }
    }
    return keywords.slice(0, 3)
  }
}

// ─── Audio Measurement Utility ───────────────────────────────────────────────

/**
 * Measures the actual duration of an audio file.
 * Tries ffprobe first (reliable JSON output), then falls back to FFmpeg stderr.
 *
 * IMPORTANT: FFmpeg always exits with code 1 when given -i without an output
 * file. We MUST use execFile so we can capture stderr independently of the
 * exit code – execPromise with `2>&1` shell redirect causes Node to throw
 * before we can read the stderr content.
 */
async function measureAudioDurationSec(filePath: string, ffmpegBin: string): Promise<number> {
  // Try ffprobe first (most reliable – native JSON, no regex parsing needed)
  const ffprobeBin = ffmpegBin.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
  try {
    const { stdout } = await execPromise(
      `"${ffprobeBin}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    )
    const val = parseFloat(stdout.trim())
    if (isFinite(val) && val > 0) return val
  } catch {
    // ffprobe not available, fall through
  }

  // FFmpeg stderr fallback
  return new Promise<number>((resolve) => {
    execFile(
      ffmpegBin,
      ['-i', filePath],
      { timeout: 10000 },
      (_err, _stdout, stderr) => {
        // Duration is always in stderr regardless of exit code
        const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
        if (m) {
          const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
          if (isFinite(secs) && secs > 0) {
            resolve(secs)
            return
          }
        }
        resolve(0) // unknown – caller uses estimated value
      }
    )
  })
}

/**
 * Segmented, Humanized Audio Engine with Micro-Pauses and Concatenation
 *
 * Key fixes:
 *   1. Each segment gets its OWN EdgeTTS instance – node-edge-tts is not
 *      re-entrant; sharing one instance across parallel calls causes
 *      file-write conflicts and produces corrupt/empty segments.
 *   2. Duration is measured via execFile+stderr (not execPromise+2>&1).
 *   3. Concat re-encodes to uniform 44100 Hz stereo 192k MP3 instead
 *      of -c copy to eliminate pops/silence at segment boundaries.
 */
export class VipeeTTSProvider implements TTSProvider {
  readonly capabilities: TTSProviderCapabilities = {
    emotion: false,
    style: false,
    pace: true,
    pitch: true,
    emphasis: true,
    ssml: false,
  }

  /**
   * Generates natural speech segmented with realistic breath/pauses
   */
  async generateSpeech(plan: SpeechPlan): Promise<AudioResult> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vipee-speech-'))
    const segmentAudioFiles: string[] = []
    const segmentTimings: AudioResult['segmentTimings'] = []
    let currentTimelineSec = 0

    try {
      const ffmpeg = getFfmpegBinaryPath()

      const voice =
        plan.voicePreset === 'Warm Reviewer' || plan.voicePreset === 'Calm Explainer'
          ? 'vi-VN-NamMinhNeural'
          : 'vi-VN-HoaiMyNeural'
      const rate =
        plan.voicePreset === 'Energetic Seller'
          ? '+12%'
          : plan.voicePreset === 'Natural Friend'
          ? '+10%'
          : plan.voicePreset === 'Curious Tester'
          ? '+8%'
          : '+5%'

      // ── Step 1: Synthesize raw segments ─────────────────────────────────
      // FIX: Each segment gets its OWN EdgeTTS instance.
      // node-edge-tts keeps internal state per call; sharing one instance
      // across concurrent promises causes file-write conflicts → corrupt/empty segments.
      await Promise.all(
        plan.segments.map(async (seg, idx) => {
          const rawSegPath = path.join(tempDir, `raw_seg_${idx}.mp3`)
          const cleanText = sanitizeTextForTTS(seg.ttsScript || seg.text)
          let success = false

          // Attempt 1: fresh EdgeTTS instance per segment
          try {
            const tts = new EdgeTTS({ voice, lang: 'vi-VN', rate })
            await tts.ttsPromise(cleanText, rawSegPath)
            if (fs.existsSync(rawSegPath) && fs.statSync(rawSegPath).size > 300) {
              success = true
            }
          } catch (e) {
            console.warn(`[VipeeTTSProvider] Segment ${idx} EdgeTTS primary failed:`, e)
          }

          // Attempt 2: retry with neutral rate
          if (!success) {
            try {
              const ttsRetry = new EdgeTTS({ voice, lang: 'vi-VN', rate: '+0%' })
              await ttsRetry.ttsPromise(cleanText, rawSegPath)
              if (fs.existsSync(rawSegPath) && fs.statSync(rawSegPath).size > 300) {
                success = true
              }
            } catch (e) {
              console.warn(`[VipeeTTSProvider] Segment ${idx} EdgeTTS retry failed:`, e)
            }
          }

          // Attempt 3: Google TTS emergency fallback
          if (!success) {
            console.warn(`[VipeeTTSProvider] Segment ${idx} falling back to Google TTS`)
            try {
              const chunk = await this.fetchGoogleTTSChunk(seg.ttsScript || seg.text)
              fs.writeFileSync(rawSegPath, chunk)
            } catch (e) {
              console.error(`[VipeeTTSProvider] Segment ${idx} ALL TTS attempts failed:`, e)
              // Write silence so concat never crashes on a missing file
              await this.writeSilenceFile(ffmpeg, rawSegPath, seg.estimatedDurationSec || 2.0)
            }
          }
        })
      )

      // ── Step 2: Apply vocal filters + measure actual durations ──────────
      for (let i = 0; i < plan.segments.length; i++) {
        const seg = plan.segments[i]
        const rawSegPath = path.join(tempDir, `raw_seg_${i}.mp3`)
        const paddedSegPath = path.join(tempDir, `padded_seg_${i}.mp3`)
        const pauseSec = (seg.pauseAfterMs || 200) / 1000

        // Studio Broadcast Vocal Processing (Warmth EQ + Presence EQ + Compand + Breath micro-pause)
        const filterStr = [
          `equalizer=f=250:t=q:w=1:g=2.0`,
          `equalizer=f=3500:t=q:w=1.2:g=2.5`,
          `compand=0.02|0.05:6:-60/-60|-24/-10|0/-2:6:0:0:0`,
          `apad=pad_dur=${pauseSec}`,
        ].join(',')

        // FIX: Force 44100 Hz stereo 192k so all segments are identical before concat
        await execPromise(
          `"${ffmpeg}" -y -i "${rawSegPath}" -af "${filterStr}" -c:a libmp3lame -b:a 192k -ar 44100 -ac 2 "${paddedSegPath}"`
        )

        // FIX: measure duration via execFile so we always get stderr content
        let segDurationSec = seg.estimatedDurationSec || 2.5
        const measured = await measureAudioDurationSec(paddedSegPath, ffmpeg)
        if (measured > 0) {
          segDurationSec = measured
        } else {
          console.warn(`[VipeeTTSProvider] Segment ${i} duration unknown, using estimate ${segDurationSec}s`)
        }

        segmentAudioFiles.push(paddedSegPath)
        segmentTimings.push({
          segmentId: seg.id,
          startSec: Number(currentTimelineSec.toFixed(3)),
          endSec: Number((currentTimelineSec + segDurationSec).toFixed(3)),
          durationSec: Number(segDurationSec.toFixed(3)),
        })
        currentTimelineSec += segDurationSec
      }

      // ── Step 3: Concatenate into master voice track ──────────────────────
      // FIX: Re-encode during concat (NOT -c copy).
      // -c copy with MP3 causes pops/silence at boundaries due to encoder
      // delay and padding headers in each segment's bitstream.
      const concatListPath = path.join(tempDir, 'voice_concat.txt')
      fs.writeFileSync(concatListPath, segmentAudioFiles.map((f) => `file '${f}'`).join('\n'))

      const masterVoicePath = path.join(tempDir, 'master_speech.mp3')
      // afade=in 40ms: eliminates the MP3 encoder-delay pop that appears at the
      // very first frame when Chromium/Remotion begins decoding the audio stream.
      await execPromise(
        `"${ffmpeg}" -y -f concat -safe 0 -i "${concatListPath}" -af "afade=t=in:st=0:d=0.04" -c:a libmp3lame -b:a 192k -ar 44100 -ac 2 "${masterVoicePath}"`
      )

      if (!fs.existsSync(masterVoicePath) || fs.statSync(masterVoicePath).size < 500) {
        throw new Error('[VipeeTTSProvider] Master voice file is empty after concat')
      }

      const masterBuffer = fs.readFileSync(masterVoicePath)
      console.log(
        `[VipeeTTSProvider] Audio OK: ${plan.segments.length} segments, ` +
        `${currentTimelineSec.toFixed(2)}s, ${(masterBuffer.length / 1024).toFixed(1)} KB`
      )

      return {
        audioBuffer: masterBuffer,
        durationSec: Number(currentTimelineSec.toFixed(2)),
        format: 'mp3',
        sampleRate: 44100,
        segmentTimings,
      }
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        console.warn('[VipeeTTSProvider] Cleanup error:', e)
      }
    }
  }

  /**
   * Writes a silent MP3 file as emergency fallback so the pipeline never
   * crashes on a missing segment file.
   */
  private async writeSilenceFile(ffmpegBin: string, outputPath: string, durationSec: number): Promise<void> {
    try {
      await execPromise(
        `"${ffmpegBin}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${durationSec} -c:a libmp3lame -b:a 192k "${outputPath}"`
      )
    } catch (e) {
      console.error('[VipeeTTSProvider] Could not write silence file:', e)
    }
  }

  /**
   * Fetches audio chunk from Google Translate TTS as last-resort fallback.
   */
  private async fetchGoogleTTSChunk(cleanText: string): Promise<Buffer> {
    const encoded = encodeURIComponent(cleanText.slice(0, 180))
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`

    return new Promise<Buffer>((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Google TTS returned HTTP ${res.statusCode}`))
            return
          }
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(Buffer.from(c)))
          res.on('end', () => resolve(Buffer.concat(chunks)))
        })
        .on('error', (e) => reject(e))
    })
  }
}
