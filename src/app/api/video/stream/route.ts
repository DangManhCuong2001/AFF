import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const fileName = request.nextUrl.searchParams.get('file')
  if (!fileName || !fileName.endsWith('.mp4') || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return NextResponse.json({ error: 'Tên tệp không hợp lệ' }, { status: 400 })
  }

  // Look in tmp renders first, then public renders
  const candidates = [
    path.join(os.tmpdir(), 'renders', fileName),
    path.join(process.cwd(), 'public', 'renders', fileName),
  ]

  let targetPath = ''
  for (const c of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ c)) {
      targetPath = c
      break
    }
  }

  if (!targetPath) {
    return NextResponse.json({ error: 'Video không tồn tại hoặc đã hết hạn' }, { status: 404 })
  }

  try {
    const stat = fs.statSync(/*turbopackIgnore: true*/ targetPath)
    const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ targetPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=3600, immutable',
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Không thể đọc tệp video: ' + (err as Error)?.message },
      { status: 500 }
    )
  }
}
