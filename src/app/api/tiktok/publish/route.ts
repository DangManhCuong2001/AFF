import { NextRequest, NextResponse } from 'next/server'
import { initDirectPost, uploadVideoChunk } from '@/lib/tiktok/posting'
import { TikTokApiError, PrivacyLevel } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

// Support up to standard payload size for video upload
export const maxDuration = 60 // 60 seconds timeout for video upload processing

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // ── Flow A: JSON Request for Step 1 (Initialize Post) ──
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const title = (body.title as string) || ''
      const privacyLevel = (body.privacyLevel as PrivacyLevel) || 'SELF_ONLY'
      const disableComment = Boolean(body.disableComment)
      const disableDuet = Boolean(body.disableDuet)
      const disableStitch = Boolean(body.disableStitch)
      const isAigc = Boolean(body.isAigc)
      const videoSize = Number(body.videoSize) || 0

      if (!title.trim()) {
        return NextResponse.json(
          { error: { code: 'MISSING_TITLE', message: 'Video caption/title is required' } },
          { status: 400 }
        )
      }

      if (videoSize <= 0) {
        return NextResponse.json(
          { error: { code: 'INVALID_FILE_SIZE', message: 'Video size must be greater than 0' } },
          { status: 400 }
        )
      }

      const initResult = await initDirectPost({
        title: title.trim(),
        privacyLevel,
        disableComment,
        disableDuet,
        disableStitch,
        isAigc,
        videoSize,
      })

      return NextResponse.json({
        success: true,
        publishId: initResult.publishId,
        uploadUrl: initResult.uploadUrl,
      })
    }

    // ── Flow B: Multipart FormData (Chunk upload OR Legacy single file) ──
    const formData = await request.formData()
    const action = formData.get('action') as string | null

    // ── Sub-Flow B1: Chunk Proxy Upload (Bypasses Vercel 4.5MB limit with 2MB chunks) ──
    if (action === 'chunk') {
      const uploadUrl = formData.get('uploadUrl') as string | null
      const chunkFile = formData.get('chunk') as File | null
      const startByte = Number(formData.get('startByte') || 0)
      const totalBytes = Number(formData.get('totalBytes') || 0)

      if (!uploadUrl || !chunkFile || totalBytes <= 0) {
        return NextResponse.json(
          { error: { code: 'INVALID_CHUNK_REQUEST', message: 'Missing uploadUrl, chunk file, or totalBytes' } },
          { status: 400 }
        )
      }

      const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer())
      await uploadVideoChunk(uploadUrl, chunkBuffer, startByte, totalBytes)

      return NextResponse.json({
        success: true,
        uploadedBytes: chunkBuffer.length,
        startByte,
      })
    }

    // ── Sub-Flow B2: Legacy single-file Direct Post ──
    const file = formData.get('video') as File | null
    const title = (formData.get('title') as string) || ''
    const privacyLevel = (formData.get('privacyLevel') as PrivacyLevel) || 'SELF_ONLY'
    const disableComment = formData.get('disableComment') === 'true'
    const disableDuet = formData.get('disableDuet') === 'true'
    const disableStitch = formData.get('disableStitch') === 'true'
    const isAigc = formData.get('isAigc') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: { code: 'MISSING_FILE', message: 'No video file provided' } },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.mp4') && file.type !== 'video/mp4') {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_TYPE', message: 'Only MP4 format is supported by TikTok Direct Post API' } },
        { status: 400 }
      )
    }

    const videoSize = file.size
    if (videoSize <= 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_SIZE', message: 'Video file is empty' } },
        { status: 400 }
      )
    }

    if (!title.trim()) {
      return NextResponse.json(
        { error: { code: 'MISSING_TITLE', message: 'Video caption/title is required' } },
        { status: 400 }
      )
    }

    // Step 1: Initialize post
    const initResult = await initDirectPost({
      title: title.trim(),
      privacyLevel,
      disableComment,
      disableDuet,
      disableStitch,
      isAigc,
      videoSize,
    })

    // Step 2: Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Step 3: Upload chunk to TikTok upload_url
    await uploadVideoChunk(initResult.uploadUrl, buffer, 0, buffer.length)

    return NextResponse.json({
      success: true,
      publishId: initResult.publishId,
      message: 'Video uploaded to TikTok storage successfully',
    })
  } catch (err: unknown) {
    if (err instanceof TikTokApiError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            logId: err.logId,
            subCode: err.subCode,
          },
        },
        { status: err.httpStatus || 400 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'UPLOAD_FAILED',
          message: (err as Error)?.message || 'Failed to initialize or upload video to TikTok',
        },
      },
      { status: 500 }
    )
  }
}
