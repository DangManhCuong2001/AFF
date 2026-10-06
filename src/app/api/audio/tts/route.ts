import { NextRequest, NextResponse } from 'next/server'
import { generateVietnameseTTS } from '@/lib/audio/tts'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const text = request.nextUrl.searchParams.get('text')
    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
    }

    const audioBuffer = await generateVietnameseTTS(text)

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
