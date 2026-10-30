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
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'
import { generateVietnameseTTS, normalizeVietnameseNumbers, sanitizeTextForTTS } from '@/lib/audio/tts'
import { parseVoiceProvider, VoiceProvider, voiceProviderLabel } from '@/lib/audio/provider'
import {generateVibiTTS} from '@/lib/audio/vibi'
import {analyzeVoiceFile, wavDuration} from '@/lib/audio/voice-processing'

const execFilePromise = promisify(execFile)

export class VipeeSpeechDirector implements SpeechDirector {
  /**
   * Phonetic mapping dictionary for natural spoken Vietnamese
   */
  private static PHONETIC_MAP: Record<string, string> = {
    'usb-c': 'u ét bê xi',
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
      const pauseBeforeMs = i === 0 ? 30 : beat === 'cta' ? 60 : 40
      const pauseAfterMs = beat === 'cta' ? 250 : beat === 'hook' ? 120 : 140
      const maxPauseAfterMs = beat === 'cta' ? 300 : 220
      const minimumDurationSec = beat === 'cta' ? 3.4 : beat === 'product_hero' || beat === 'reveal' ? 2.8 : 2.6

      // Word count estimated duration (Vietnamese average: ~3.5 to 4.2 words per second at normal pace)
      const wordCount = spokenText.split(/\s+/).filter(Boolean).length
      const spokenEstimate = wordCount / (3.8 * pace)
      const estimatedSec = Math.max(spokenEstimate + (pauseBeforeMs + pauseAfterMs) / 1000, Math.min(minimumDurationSec, spokenEstimate + (pauseBeforeMs + maxPauseAfterMs) / 1000))
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
        minimumDurationSec,
        maxPauseAfterMs,
      })
    }

    return {
      voicePreset,
      segments,
      totalEstimatedDurationSec: Number(totalEstimatedDuration.toFixed(2)),
    }
  }

  /** Preserve sourced copy: speech processing must not introduce claims or reviews. */
  private humanizeSpokenVietnamese(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Converts display text into pronunciation-friendly script for Vietnamese TTS
   */
  private generateTTSScript(text: string): string {
    let tts = normalizeVietnameseNumbers(text).replace(/\b3M\b/g, 'ba mờ').toLowerCase()

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

/**
 * Segmented speech with one selected provider, measured timing and uniform MP3 output.
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
  async generateSpeech(plan: SpeechPlan, options?: { provider?: VoiceProvider }): Promise<AudioResult> {
    const provider = parseVoiceProvider(options?.provider)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vipee-speech-'))
    const segmentAudioFiles: string[] = []
    const segmentTimings: AudioResult['segmentTimings'] = []
    let currentTimelineSec = 0

    try {
      const ffmpeg = getFfmpegBinaryPath()

      // Use one explicitly selected provider for every segment.
      for (let idx = 0; idx < plan.segments.length; idx++) {
        const seg = plan.segments[idx]
        const rawSegPath = path.join(tempDir, `raw_seg_${idx}.mp3`)
        const cleanText = sanitizeTextForTTS(seg.ttsScript || seg.text)
        let success = false

        if (provider === 'google') {
          success = await this.synthesizeGoogleTTS(cleanText, rawSegPath)
        } else if (provider === 'vibi' || provider === 'vibi-capcut') {
          success = await this.synthesizeVibi(cleanText, rawSegPath, provider === 'vibi-capcut' ? 'capcut' : undefined)
        } else {
          if (!process.env.ELEVENLABS_API_KEY?.trim()) {
            throw new Error('Chưa cấu hình ELEVENLABS_API_KEY')
          }
          success = await this.synthesizeElevenLabs(cleanText, rawSegPath, plan.voicePreset)
        }
        if (!success) {
          throw new Error(`Không thể tạo giọng ${voiceProviderLabel(provider)} cho cảnh ${idx + 1}. Vui lòng thử lại.`)
        }

        // Pacing delay between segments to prevent socket rate limits
        if (idx < plan.segments.length - 1) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }

      // ── Step 2: Apply vocal filters + measure actual durations ──────────
      for (let i = 0; i < plan.segments.length; i++) {
        const seg = plan.segments[i]
        const rawSegPath = path.join(tempDir, `raw_seg_${i}.mp3`)
        const paddedSegPath = path.join(tempDir, `padded_seg_${i}.wav`)
        const pace = Math.max(0.85, Math.min(1.1, seg.pace || 1))
        const raw = await analyzeVoiceFile(rawSegPath, ffmpeg)
        const spokenDuration = (raw.trimEndSec - raw.trimStartSec) / pace
        const beforeSec = Math.max(0, seg.pauseBeforeMs) / 1000
        const desiredPause = Math.max(
          Math.max(0, seg.pauseAfterMs) / 1000,
          (seg.minimumDurationSec || 0) - beforeSec - spokenDuration,
        )
        const pauseSec = seg.maxPauseAfterMs === undefined ? desiredPause : Math.min(desiredPause, Math.max(0, seg.maxPauseAfterMs) / 1000)
        // Trim only provider-added outer silence, retaining phoneme margins and
        // all pauses inside the sentence. Encode segments as PCM, not separate MP3s.
        const pacingFilters = ['asetpts=PTS-STARTPTS', `atrim=start=${raw.trimStartSec}:end=${raw.trimEndSec}`, 'asetpts=PTS-STARTPTS', `atempo=${pace}`, `adelay=${Math.round(beforeSec * 1000)}:all=1`, `apad=pad_dur=${pauseSec}`]
        const filterStr = [
          `equalizer=f=250:t=q:w=1:g=2.0`,
          `equalizer=f=3500:t=q:w=1.2:g=2.5`,
          `compand=attacks=0.02:decays=0.05:points=-60/-60|-24/-10|0/-2:soft-knee=6`,
          ...pacingFilters,
        ].join(',')
        const encodeSegment = (filters: string) => promisify(execFile)(ffmpeg, [
          '-y', '-i', rawSegPath, '-af', filters,
          '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', paddedSegPath,
        ])
        try {
          await encodeSegment(filterStr)
        } catch (filterErr) {
          console.warn(`[VipeeTTSProvider] Segment ${i} vocal filter error, retaining pacing:`, filterErr)
          await encodeSegment(pacingFilters.join(','))
        }

        const segDurationSec = wavDuration(fs.readFileSync(paddedSegPath))
        const actual = await analyzeVoiceFile(paddedSegPath, ffmpeg)
        const speechOffsetSec = actual.speechStartSec
        const speechDurationSec = actual.speechEndSec - actual.speechStartSec

        segmentAudioFiles.push(paddedSegPath)
        segmentTimings.push({
          segmentId: seg.id,
          startSec: Number(currentTimelineSec.toFixed(6)),
          endSec: Number((currentTimelineSec + segDurationSec).toFixed(6)),
          durationSec: Number(segDurationSec.toFixed(6)),
          speechOffsetSec,
          speechDurationSec: Number(Math.min(speechDurationSec, segDurationSec - speechOffsetSec).toFixed(6)),
        })
        currentTimelineSec += segDurationSec
      }

      // ── Step 3: Concatenate into master voice track ──────────────────────
      // Concatenate sample-exact PCM, then encode MP3 once for the entire narration.
      const concatListPath = path.join(tempDir, 'voice_concat.txt')
      fs.writeFileSync(concatListPath, segmentAudioFiles.map((f) => `file '${f}'`).join('\n'))

      const masterVoicePath = path.join(tempDir, 'master_speech.mp3')
      // afade=in 40ms: eliminates the MP3 encoder-delay pop that appears at the
      // very first frame when Chromium/Remotion begins decoding the audio stream.
      await execFilePromise(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-af', 'afade=t=in:st=0:d=0.02', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', masterVoicePath])

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
        durationSec: Number(currentTimelineSec.toFixed(6)),
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
   * Ultra-realistic Human Speech Synthesis via ElevenLabs
   * Uses eleven_flash_v2_5 (50% cheaper credits, < 1s latency, native Vietnamese)
   */
  private async synthesizeElevenLabs(
    text: string,
    outputPath: string,
    preset: VoicePersonality
  ): Promise<boolean> {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
    if (!apiKey) return false

    // Priority: Default Voice ID configured by user (default: s6W2NupNY6TykGJoDtWy)
    const explicitVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim()
    const configuredVoiceId = explicitVoiceId || 's6W2NupNY6TykGJoDtWy'

    // Preset mapping for premade voices (fallback if user is on Free tier without library voice permissions)
    let fallbackVoiceId = 'cgSgspJ2msm6clMCkdW9' // Jessica (Female)
    if (preset === 'Warm Reviewer' || preset === 'Calm Explainer') {
      fallbackVoiceId = 'JBFqnCBsd6RMkjVDRZzb' // George (Male)
    } else if (preset === 'Energetic Seller') {
      fallbackVoiceId = 'Xb7hH8MSUJpSbSDYk0k2' // Alice (Female)
    }

    const voiceId = configuredVoiceId || fallbackVoiceId

    try {
      let res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      })

      // If library voice is restricted on current ElevenLabs plan (HTTP 402 paid plan required), retry with premade voice
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.warn(`[VipeeTTSProvider] ElevenLabs voice ${voiceId} HTTP ${res.status}:`, errText)

        if (!explicitVoiceId && (errText.includes('cannot use library voices') || res.status === 402)) {
          console.warn(`[VipeeTTSProvider] Voice ${voiceId} requires paid plan. Automatically falling back to premade voice ${fallbackVoiceId}...`)
          res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${fallbackVoiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_flash_v2_5',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          })
        }

        if (!res.ok) return false
      }

      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 500) {
        fs.writeFileSync(outputPath, buf)
        return true
      }
      return false
    } catch (err) {
      console.warn('[VipeeTTSProvider] ElevenLabs synthesis failed:', err)
      return false
    }
  }

  private async synthesizeGoogleTTS(text: string, outputPath: string): Promise<boolean> {
    const buffer = await generateVietnameseTTS(text, { provider: 'google' })
    fs.writeFileSync(outputPath, buffer)
    return true
  }

  private async synthesizeVibi(text: string, outputPath: string, upstreamProvider?: 'capcut'): Promise<boolean> {
    const buffer = await generateVibiTTS(text, {upstreamProvider})
    fs.writeFileSync(outputPath, buffer)
    return buffer.length > 500
  }

}
