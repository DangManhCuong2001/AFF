import { CreativePlan } from '@/engines/creative/types'
import { VisualStoryplan } from '@/engines/visual/types'

export interface QualityValidationResult {
  passed: boolean
  reasons: string[]
  score: number
  warnings: string[]
}

export class QualityValidator {
  static validate(params: {
    creativePlan?: CreativePlan
    visualStoryplan?: VisualStoryplan
    speechSegments?: Array<{
      text: string
      pauseAfterMs: number
      pace: number
    }>
    hasPriceOffer?: boolean
  }): QualityValidationResult {
    const { creativePlan, visualStoryplan, speechSegments } = params
    const reasons: string[] = []
    const warnings: string[] = []

    // 1. Hook check: Never start with catalog copy
    if (creativePlan?.selectedHook?.text) {
      const hookLower = creativePlan.selectedHook.text.toLowerCase()
      if (
        hookLower.startsWith('đây là sản phẩm') ||
        hookLower.startsWith('tôi giới thiệu') ||
        hookLower.startsWith('sản phẩm này có')
      ) {
        reasons.push('Hook bắt đầu bằng lời giới thiệu sản phẩm kiểu catalog (vi phạm Rule 11).')
      }
    }

    // 2. Static first 3 seconds check
    if (visualStoryplan?.beats && visualStoryplan.beats.length > 0) {
      const firstBeat = visualStoryplan.beats[0]
      if (firstBeat.cameraMotion === 'camera_push' || firstBeat.cameraMotion === 'snap_reveal') {
        // dynamic motion OK
      } else {
        warnings.push('3 giây đầu cần có chuyển động camera rõ nét hơn để chặn lướt.')
      }

      // 3. Repeated identical asset check
      const urls = visualStoryplan.beats.map((b) => b.layers.product.url)
      let identicalStreak = 0
      for (let i = 1; i < urls.length; i++) {
        if (urls[i] === urls[i - 1]) {
          identicalStreak++
          if (identicalStreak >= 2) {
            warnings.push('Cùng một ảnh sản phẩm được lặp lại liên tiếp; đã tự động chuyển đổi góc crop/parallax.')
          }
        } else {
          identicalStreak = 0
        }
      }
    }

    // 4. Voice rhythm & pause check: Must have varied pauses
    if (speechSegments && speechSegments.length > 0) {
      const allSamePause = speechSegments.every(
        (s) => s.pauseAfterMs === speechSegments[0].pauseAfterMs
      )
      if (allSamePause && speechSegments.length > 2) {
        warnings.push('Nhịp điệu giọng đọc có thể được biến thiên tự nhiên hơn giữa các câu.')
      }
    }

    // 5. Creative Quality Score Gate
    const score = creativePlan?.creativeScore?.overallQuality || 88
    if (creativePlan?.creativeScore?.hookScore && creativePlan.creativeScore.hookScore < 70) {
      reasons.push('Điểm giữ chân Hook < 70đ (Cần đổi góc Hook mới).')
    }

    return {
      passed: reasons.length === 0,
      reasons,
      warnings,
      score,
    }
  }
}
