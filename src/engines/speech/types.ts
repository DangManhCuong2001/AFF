import { EmotionalTone } from '@/engines/creative/types'
import { SpeechIntent } from '@/engines/core/contracts'
export type { SpeechIntent }

export type VoicePersonality =
  | 'Natural Friend'
  | 'Warm Reviewer'
  | 'Curious Tester'
  | 'Energetic Seller'
  | 'Calm Explainer'

export interface SpeechSegment {
  id: string
  text: string // Spoken Vietnamese with natural rhythm
  intent: SpeechIntent // hook, relatable, annoyed, curious, reveal, satisfied, offer, cta
  pace: number // 0.8 to 1.2, default 1.0
  energy: number // 0.4 to 1.0, default 0.7
  pauseBeforeMs: number // Micro-pause before utterance (e.g. 0 to 300ms)
  pauseAfterMs: number // Breath/dramatic pause after utterance (e.g. 200 to 500ms)
  emphasisWords: string[] // Key words to stress
  displayScript?: string // Formal onscreen text / subtitle
  ttsScript?: string // Pronunciation-optimized for TTS (phonetics, pauses, foreign word mapping)
  emotion?: EmotionalTone
  emphasis?: string[] // Key words to stress (legacy)
  estimatedDurationSec?: number
}

export interface SpeechPlan {
  voicePreset: VoicePersonality
  segments: SpeechSegment[]
  totalEstimatedDurationSec: number
}

export interface TTSProviderCapabilities {
  emotion: boolean
  style: boolean
  pace: boolean
  pitch: boolean
  emphasis: boolean
  ssml: boolean
}

export interface AudioResult {
  audioBuffer: Buffer
  durationSec: number
  format: 'mp3' | 'wav'
  sampleRate: number
  segmentTimings: {
    segmentId: string
    startSec: number
    endSec: number
    durationSec: number
  }[]
}

export interface TTSProvider {
  capabilities: TTSProviderCapabilities
  generateSpeech(plan: SpeechPlan): Promise<AudioResult>
}

export interface SpeechDirector {
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
  ): SpeechPlan
}
