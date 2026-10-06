import { NextResponse } from 'next/server'
import { queryCreatorInfo } from '@/lib/tiktok/creator-info'
import { TikTokApiError } from '@/lib/tiktok/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const creatorInfo = await queryCreatorInfo()
    return NextResponse.json({ creatorInfo })
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
          code: 'CREATOR_INFO_ERROR',
          message: (err as Error)?.message || 'Failed to query creator info',
        },
      },
      { status: 500 }
    )
  }
}
