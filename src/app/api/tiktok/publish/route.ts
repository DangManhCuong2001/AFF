import { NextRequest, NextResponse } from 'next/server'
import { initDirectPost, initInboxUpload, uploadVideoChunk } from '@/lib/tiktok/posting'
import {postingInitRequestSchema} from '@/lib/tiktok/schemas'
import {fileUploadPlan, uploadRanges} from '@/lib/tiktok/posting-mode'
import { TikTokApiError, PrivacyLevel } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

// Support up to standard payload size for video upload
export const maxDuration = 60 // 60 seconds timeout for video upload processing

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // ── Flow A: JSON Request for Step 1 (Initialize Post) ──
    if (contentType.includes('application/json')) {
      const input = postingInitRequestSchema.safeParse(await request.json().catch(() => null))
      if (!input.success) return NextResponse.json({error: {code: 'INVALID_REQUEST', message: 'Chọn đúng cách gửi, dung lượng video và caption (khi đăng trực tiếp).'}}, {status: 400})
      const body = input.data
      const initResult = body.mode === 'upload'
        ? await initInboxUpload(body.videoSize)
        : await initDirectPost(body)
      return NextResponse.json({success: true, mode: body.mode, ...initResult})
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

      if (!uploadUrl || !chunkFile || typeof chunkFile === 'string' || !Number.isSafeInteger(totalBytes) || totalBytes <= 0 || totalBytes > 4 * 1024 ** 3) {
        return NextResponse.json(
          { error: { code: 'INVALID_CHUNK_REQUEST', message: 'Missing uploadUrl, chunk file, or totalBytes' } },
          { status: 400 }
        )
      }

      const plan = fileUploadPlan(totalBytes)
      const range = uploadRanges(totalBytes, plan.chunkSize, plan.totalChunkCount).find((range) => range.start === startByte)
      if (!range || chunkFile.size !== range.end - range.start) return NextResponse.json({error: {code: 'INVALID_CHUNK_RANGE', message: 'Phân đoạn không khớp dung lượng đã khai báo với TikTok.'}}, {status: 400})
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
    const mode = formData.get('mode') || 'publish'
    if (mode !== 'publish' && mode !== 'upload') return NextResponse.json({error: {code: 'INVALID_MODE', message: 'Cách gửi video không hợp lệ.'}}, {status: 400})
    const privacyLevel = (formData.get('privacyLevel') as PrivacyLevel) || 'SELF_ONLY'
    const disableComment = formData.get('disableComment') === 'true'
    const disableDuet = formData.get('disableDuet') === 'true'
    const disableStitch = formData.get('disableStitch') === 'true'
    const isAigc = formData.get('isAigc') === 'true'

    if (!file || typeof file === 'string') {
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
    if (videoSize <= 0 || videoSize > 4 * 1024 ** 3) {
      return NextResponse.json(
        { error: { code: 'INVALID_FILE_SIZE', message: 'Video file is empty' } },
        { status: 400 }
      )
    }

    if (mode === 'publish' && !title.trim()) {
      return NextResponse.json(
        { error: { code: 'MISSING_TITLE', message: 'Video caption/title is required' } },
        { status: 400 }
      )
    }

    // Step 1: Initialize post
    const initResult = mode === 'upload' ? await initInboxUpload(videoSize) : await initDirectPost({
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
    for (const range of uploadRanges(buffer.length, initResult.chunkSize, initResult.totalChunkCount)) {
      await uploadVideoChunk(initResult.uploadUrl, buffer.subarray(range.start, range.end), range.start, buffer.length)
    }

    return NextResponse.json({
      success: true,
      mode,
      publishId: initResult.publishId,
      message: 'Đã gửi file tới TikTok. Đang chờ TikTok xác nhận xử lý.',
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
        { status: err.httpStatus && err.httpStatus >= 400 ? err.httpStatus : 400 }
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
