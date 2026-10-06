import { tiktokFetch } from './client'
import { CreatorInfo, PrivacyLevel } from './types'
import { creatorInfoApiResponseSchema } from './schemas'

export async function queryCreatorInfo(): Promise<CreatorInfo> {
  const result = await tiktokFetch<unknown>('/post/publish/creator_info/query/', {
    method: 'POST',
    body: {},
    requireAuth: true,
  })

  const parsed = creatorInfoApiResponseSchema.safeParse(result.raw)

  if (!parsed.success || !parsed.data.data) {
    throw new Error('Invalid Creator Info response format received from TikTok.')
  }

  const raw = parsed.data.data

  return {
    creatorAvatarUrl: raw.creator_avatar_url || '',
    creatorUsername: raw.creator_username || '',
    creatorNickname: raw.creator_nickname || '',
    privacyLevelOptions: (raw.privacy_level_options as PrivacyLevel[]) || ['SELF_ONLY'],
    commentDisabled: Boolean(raw.comment_disabled),
    duetDisabled: Boolean(raw.duet_disabled),
    stitchDisabled: Boolean(raw.stitch_disabled),
    maxVideoPostDurationSec: raw.max_video_post_duration_sec || 600,
  }
}
