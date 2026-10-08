import { NextRequest, NextResponse } from 'next/server'
import { VipeeSpeechDirector, VipeeTTSProvider } from '@/engines/speech/VipeeSpeechDirector'
import { StoryboardScene } from '@/engines/core/types'
import { VoicePersonality } from '@/engines/speech/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const scenes: StoryboardScene[] = body.scenes || []
    const voicePreset: VoicePersonality = body.voicePreset || 'Natural Friend'

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes are required' }, { status: 400 })
    }

    const speechDirector = new VipeeSpeechDirector()
    const speechPlan = speechDirector.createSpeechPlan(
      {
        scenes: scenes.map((s) => ({
          id: s.id,
          voice: s.voice || s.headline,
          storyBeat: s.type || 'demo',
          emphasisWords: s.keywords,
        })),
      },
      { voicePreset }
    )

    const ttsProvider = new VipeeTTSProvider()
    const result = await ttsProvider.generateSpeech(speechPlan)

    return new NextResponse(result.audioBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(result.audioBuffer.length),
        'X-Audio-Duration': String(result.durationSec),
        'X-Segment-Timings': JSON.stringify(result.segmentTimings),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: unknown) {
    console.error('[StoryboardVoiceAPI] Failed to generate storyboard audio:', err)
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to generate storyboard voice' },
      { status: 500 }
    )
  }
}
