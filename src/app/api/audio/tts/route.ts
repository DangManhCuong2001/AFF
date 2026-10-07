import { NextRequest, NextResponse } from 'next/server'
import { generateVietnameseTTS, VietnameseVoice } from '@/lib/audio/tts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const text = request.nextUrl.searchParams.get('text')
    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
    }

    const voiceParam = request.nextUrl.searchParams.get('voice') as VietnameseVoice | null
    const presetParam = request.nextUrl.searchParams.get('preset')

    let voice: VietnameseVoice = voiceParam || 'vi-VN-HoaiMyNeural'
    let rate = '+12%'

    if (presetParam === 'Warm Reviewer' || presetParam === 'Calm Explainer') {
      voice = 'vi-VN-NamMinhNeural'
      rate = '+6%'
    } else if (presetParam === 'Energetic Seller') {
      voice = 'vi-VN-HoaiMyNeural'
      rate = '+15%'
    } else if (presetParam === 'Curious Tester') {
      voice = 'vi-VN-HoaiMyNeural'
      rate = '+10%'
    }

    const audioBuffer = await generateVietnameseTTS(text, { voice, rate })

    return new NextResponse(audioBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Failed to generate audio' },
      { status: 500 }
    )
  }
}
