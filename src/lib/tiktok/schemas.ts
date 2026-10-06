import { z } from 'zod'

export const privacyLevelSchema = z.enum([
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
])

export const oauthTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  open_id: z.string(),
  refresh_expires_in: z.number().optional(),
  refresh_token: z.string(),
  scope: z.string(),
  token_type: z.string(),
})

export const tikTokErrorSchema = z.object({
  code: z.union([z.string(), z.number()]),
  message: z.string(),
  log_id: z.string().optional(),
  sub_code: z.string().optional(),
})

export const creatorInfoApiResponseSchema = z.object({
  data: z.object({
    creator_avatar_url: z.string().default(''),
    creator_username: z.string().default(''),
    creator_nickname: z.string().default(''),
    privacy_level_options: z.array(z.string()).default([]),
    comment_disabled: z.boolean().default(false),
    duet_disabled: z.boolean().default(false),
    stitch_disabled: z.boolean().default(false),
    max_video_post_duration_sec: z.number().default(600),
  }).optional(),
  error: tikTokErrorSchema,
})

export const initVideoPostApiResponseSchema = z.object({
  data: z.object({
    publish_id: z.string(),
    upload_url: z.string(),
  }).optional(),
  error: tikTokErrorSchema,
})

export const publishStatusApiResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    fail_reason: z.string().optional(),
    post_ids: z.array(z.union([z.string(), z.number()])).optional(),
    publicaly_available_post_id: z.union([
      z.array(z.union([z.string(), z.number()])),
      z.string(),
      z.number(),
    ]).optional(),
    publicity_check_state: z.string().optional(),
  }).passthrough().optional(),
  error: tikTokErrorSchema.optional(),
}).passthrough()

export const directPostClientRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(2200, 'Title cannot exceed 2200 characters'),
  privacyLevel: privacyLevelSchema,
  disableComment: z.boolean().default(false),
  disableDuet: z.boolean().default(false),
  disableStitch: z.boolean().default(false),
  isAigc: z.boolean().default(false),
  videoCoverTimestampMs: z.number().optional().default(1000),
})
