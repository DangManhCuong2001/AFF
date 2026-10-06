import { NextRequest, NextResponse } from 'next/server'
import { getPublishStatus } from '@/lib/tiktok/posting'
import { TikTokApiError } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const publishId = searchParams.get('publish_id')

  if (!publishId) {
    return NextResponse.json(
      { error: { code: 'MISSING_PARAM', message: 'Query parameter publish_id is required' } },
      { status: 400 }
    )
  }

  try {
    const result = await getPublishStatus(publishId)
    return NextResponse.json(result)
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
          code: 'STATUS_FETCH_ERROR',
          message: (err as Error)?.message || 'Failed to query TikTok publish status',
        },
      },
      { status: 500 }
    )
  }
}
