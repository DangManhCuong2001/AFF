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
import { exec } from 'child_process'
import { promisify } from 'util'
import { getFfmpegBinaryPath } from '@/lib/video/ffmpeg'

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

      segments.push({
        id: s.id || `seg-${i + 1}`,
        text: spokenText,
        displayScript: rawVoice,
        ttsScript,
        emotion,
        pace,
        energy: beat === 'hook' || beat === 'cta' ? 0.85 : beat === 'problem' ? 0.6 : 0.75,
        pauseBeforeMs,
        pauseAfterMs,
        emphasis: s.emphasisWords || this.extractKeyEmphasisWords(spokenText),
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
   * Humanizes sentences into natural spoken Vietnamese phrasing
   */
  private humanizeSpokenVietnamese(text: string): string {
    let t = text.trim()
    // Replace rigid written phrases with warm spoken phrases
    t = t.replace(/Sản phẩm sở hữu thiết kế/gi, 'Nhìn thiết kế')
    t = t.replace(/giúp tối ưu không gian/gi, 'góc nhà gọn hơn hẳn')
    t = t.replace(/được trang bị/gi, 'có sẵn')
    t = t.replace(/phù hợp với nhiều không gian/gi, 'để ở đâu cũng tiện')
    t = t.replace(/kích thước nhỏ gọn/gi, 'nhỏ xíu mà tiện')
    t = t.replace(/mang lại cảm giác/gi, 'thấy')
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

    // Add punctuation micro-pauses for natural breath:
    tts = tts.replace(/\.\.\./g, ', ')
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
 * Segmented, Humanized Audio Engine with Micro-Pauses and Concatenation
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

      for (let i = 0; i < plan.segments.length; i++) {
        const seg = plan.segments[i]
        const rawChunkBuffer = await this.fetchSingleGoogleTTSChunk(seg.ttsScript)
        const rawSegPath = path.join(tempDir, `raw_seg_${i}.mp3`)
        fs.writeFileSync(rawSegPath, rawChunkBuffer)

        // Add pause after (silence pad using FFmpeg) and modulate speed/tempo
        const paddedSegPath = path.join(tempDir, `padded_seg_${i}.mp3`)
        const pauseSec = (seg.pauseAfterMs || 250) / 1000
        const tempo = Math.max(0.85, Math.min(1.2, seg.pace || 1.0))

        // FFmpeg filter: atempo for pace, apad to inject natural human breathing pause
        const filterStr = `atempo=${tempo},apad=pad_dur=${pauseSec}`
        const cmd = `"${ffmpeg}" -y -i "${rawSegPath}" -af "${filterStr}" -c:a libmp3lame -b:a 128k "${paddedSegPath}"`
        await execPromise(cmd)

        // Measure actual audio segment duration
        const durationCmd = `"${ffmpeg}" -i "${paddedSegPath}" 2>&1`
        let segDurationSec = seg.estimatedDurationSec
        try {
          const { stderr } = await execPromise(durationCmd)
          const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
          if (durationMatch) {
            const hours = Number(durationMatch[1])
            const mins = Number(durationMatch[2])
            const secs = Number(durationMatch[3])
            segDurationSec = hours * 3600 + mins * 60 + secs
          }
        } catch {
          // ffmpeg exits with code 1 when no output file is provided, stderr contains duration
        }

        segmentAudioFiles.push(paddedSegPath)
        segmentTimings.push({
          segmentId: seg.id,
          startSec: Number(currentTimelineSec.toFixed(2)),
          endSec: Number((currentTimelineSec + segDurationSec).toFixed(2)),
          durationSec: Number(segDurationSec.toFixed(2)),
        })
        currentTimelineSec += segDurationSec
      }

      // Concat all padded segments into final Master Voice track
      const concatListPath = path.join(tempDir, 'voice_concat.txt')
      fs.writeFileSync(concatListPath, segmentAudioFiles.map((f) => `file '${f}'`).join('\n'))

      const masterVoicePath = path.join(tempDir, 'master_speech.mp3')
      await execPromise(`"${ffmpeg}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${masterVoicePath}"`)

      const masterBuffer = fs.readFileSync(masterVoicePath)

      return {
        audioBuffer: masterBuffer,
        durationSec: Number(currentTimelineSec.toFixed(2)),
        format: 'mp3',
        sampleRate: 24000,
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
   * Fetches clean audio chunk from reliable TTS endpoint
   */
  private async fetchSingleGoogleTTSChunk(cleanText: string): Promise<Buffer> {
    const encoded = encodeURIComponent(cleanText.slice(0, 180))
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`

    return new Promise<Buffer>((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`TTS returned HTTP ${res.statusCode}`))
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
