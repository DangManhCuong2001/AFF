import { VisualBeat } from '@/engines/core/contracts'

export interface VisualBeatTimelineState {
  headlineProgress: number
  productEnterProgress: number
  activeBenefitCount: number
  focusProgress: number
  priceProgress: number
  ctaProgress: number
}

export class VisualBeatEngine {
  /**
   * Generates standard internal motion beats for a scene of given duration
   */
  static generateDefaultBeatsForScene(
    sceneId: string,
    durationSec: number,
    benefitCount = 2,
    hasPrice = false,
    isCta = false
  ): VisualBeat[] {
    const beats: VisualBeat[] = []
    const totalMs = durationSec * 1000

    // 1. Headline enters immediately at 0ms
    beats.push({
      id: `${sceneId}-beat-headline`,
      atMs: 0,
      type: 'headline-enter',
      payload: { motion: 'fade-up' },
    })

    // 2. Product enters quickly at 350ms
    beats.push({
      id: `${sceneId}-beat-product`,
      atMs: Math.min(350, totalMs * 0.15),
      type: 'product-enter',
      payload: { scale: 1.0 },
    })

    // 3. Staggered Benefit chips (e.g. at 1100ms, 1800ms)
    for (let i = 0; i < benefitCount; i++) {
      const atMs = Math.round(1000 + i * 700)
      if (atMs < totalMs * 0.85) {
        beats.push({
          id: `${sceneId}-beat-benefit-${i + 1}`,
          atMs,
          type: 'benefit-enter',
          payload: { chipIndex: i },
        })
      }
    }

    // 4. Product Focus (zoom pulse or pan) at 2500ms
    const focusAtMs = Math.round(Math.min(2500, totalMs * 0.7))
    beats.push({
      id: `${sceneId}-beat-focus`,
      atMs: focusAtMs,
      type: 'product-focus',
      payload: { zoomFactor: 1.1 },
    })

    // 5. Price enter if present
    if (hasPrice) {
      beats.push({
        id: `${sceneId}-beat-price`,
        atMs: Math.round(totalMs * 0.5),
        type: 'price-enter',
        payload: {},
      })
    }

    // 6. CTA enter if CTA scene
    if (isCta) {
      beats.push({
        id: `${sceneId}-beat-cta`,
        atMs: Math.round(totalMs * 0.4),
        type: 'cta-enter',
        payload: {},
      })
    }

    return beats.sort((a, b) => a.atMs - b.atMs)
  }

  /**
   * Computes current animated state for given frame in Remotion
   */
  static evaluateBeats(
    beats: VisualBeat[],
    frame: number,
    fps: number
  ): VisualBeatTimelineState {
    const currentMs = (frame / fps) * 1000

    let headlineProgress = 0
    let productEnterProgress = 0
    let activeBenefitCount = 0
    let focusProgress = 0
    let priceProgress = 0
    let ctaProgress = 0

    for (const beat of beats) {
      const diffMs = currentMs - beat.atMs
      const progress = Math.min(1, Math.max(0, diffMs / 350)) // 350ms standard transition duration

      switch (beat.type) {
        case 'headline-enter':
          headlineProgress = Math.max(headlineProgress, progress)
          break
        case 'product-enter':
          productEnterProgress = Math.max(productEnterProgress, progress)
          break
        case 'benefit-enter':
          if (diffMs >= 0) activeBenefitCount++
          break
        case 'product-focus':
          focusProgress = Math.max(focusProgress, progress)
          break
        case 'price-enter':
          priceProgress = Math.max(priceProgress, progress)
          break
        case 'cta-enter':
          ctaProgress = Math.max(ctaProgress, progress)
          break
      }
    }

    return {
      headlineProgress,
      productEnterProgress,
      activeBenefitCount,
      focusProgress,
      priceProgress,
      ctaProgress,
    }
  }
}
