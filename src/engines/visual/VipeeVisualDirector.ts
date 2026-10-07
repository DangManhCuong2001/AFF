import {
  CameraMotionType,
  ShotType,
  VisualBeat,
  VisualDirector,
  VisualStoryplan,
} from './types'

export class VipeeVisualDirector implements VisualDirector {
  createVisualStoryplan(params: {
    speechTimings: Array<{
      segmentId: string
      text: string
      emotion: string
      startSec: number
      endSec: number
      durationSec: number
      emphasis?: string[]
      syncTriggerPhrase?: string
    }>
    productImages: string[]
    productName: string
    category: string
  }): VisualStoryplan {
    const { speechTimings, productImages, productName, category } = params
    const primaryImg = productImages[0] || '/backgrounds/minimal_lifestyle.png'
    const totalDuration = speechTimings.reduce((sum, s) => sum + s.durationSec, 0)

    const beats: VisualBeat[] = speechTimings.map((seg, idx) => {
      const isHook = idx === 0
      const isProblem = idx === 1
      const isReveal = idx === 2
      const isDemo = idx === 3
      const isPayoff = idx === 4
      const isCTA = idx >= 5 || idx === speechTimings.length - 1

      // 1. Determine Shot Type
      let shotType: ShotType = 'EstablishingShot'
      let cameraMotion: CameraMotionType = 'camera_push'
      let productVisible = true
      let productRevealDelaySec = 0
      let sfxCue: VisualBeat['sfxCue'] = 'none'
      let sfxDelaySec = 0
      let visualIntent = ''

      // 2. Select image asset with round-robin or contextual index
      const assetIdx = isHook ? 0 : isReveal ? 0 : (idx % Math.max(1, productImages.length))
      const currentAsset = productImages[assetIdx] || primaryImg

      if (isHook) {
        shotType = 'EstablishingShot'
        cameraMotion = 'camera_push'
        productVisible = true // or reveal after 0.5s
        visualIntent = 'Pattern interrupt: Tạo tò mò và dừng ngón tay lướt của người xem'
        sfxCue = 'whoosh'
        sfxDelaySec = 0.1
      } else if (isProblem) {
        shotType = 'ProblemCloseup'
        cameraMotion = 'parallax_left'
        productVisible = false // Show problem context first
        visualIntent = 'Truyền tải cảm giác bực mình và bất tiện quen thuộc hàng ngày'
        sfxCue = 'none'
      } else if (isReveal) {
        shotType = 'ProductRevealShot'
        cameraMotion = 'snap_reveal'
        productVisible = true
        // Phrase level synchronization: trigger reveal after ~0.6s into speech
        productRevealDelaySec = 0.6
        visualIntent = `Product Reveal: Xuất hiện sản phẩm ${productName} như vị cứu tinh`
        sfxCue = 'whoosh'
        sfxDelaySec = 0.6
      } else if (isDemo) {
        shotType = 'DemoShot'
        cameraMotion = 'macro_zoom'
        productVisible = true
        visualIntent = 'Thao tác sử dụng trực quan: Giải quyết triệt để vấn đề'
        sfxCue = 'snap'
        sfxDelaySec = 0.3
      } else if (isPayoff) {
        shotType = 'ResultShot'
        cameraMotion = 'camera_pull'
        productVisible = true
        visualIntent = 'Kết quả thỏa mãn: Không gian ngăn nắp, tâm lý nhẹ nhõm'
        sfxCue = 'pop'
        sfxDelaySec = 0.4
      } else {
        shotType = 'CTAShot'
        cameraMotion = 'camera_push'
        productVisible = true
        visualIntent = 'Kêu gọi hành động tự nhiên dẫn tới giỏ hàng TikTok Shop'
        sfxCue = 'click'
        sfxDelaySec = 0.2
      }

      // 3. Configure Transform for Depth and Parallax
      const bgTransform = {
        scaleStart: 1.0,
        scaleEnd: 1.15,
        translateXStart: cameraMotion === 'parallax_left' ? -15 : 0,
        translateXEnd: cameraMotion === 'parallax_left' ? 15 : 0,
        translateYStart: 0,
        translateYEnd: cameraMotion === 'camera_push' ? -10 : 10,
      }

      const productTransform = {
        scaleStart: isReveal ? 0.8 : 0.95,
        scaleEnd: 1.05,
        translateXStart: 0,
        translateXEnd: 0,
        translateYStart: isReveal ? 30 : 0,
        translateYEnd: 0,
      }

      // 4. Background Environment Context
      const isOffice = category === 'home' || productName.toLowerCase().includes('dây') || productName.toLowerCase().includes('bàn')
      const bgUrl = isOffice
        ? '/backgrounds/desk_workspace.png'
        : category === 'tech'
        ? '/backgrounds/minimal_lifestyle.png'
        : '/backgrounds/kitchen_modern.png'

      // 5. Typography setup
      const badgeText = isHook
        ? '🔥 TIKTOK UGC • 3S HOOK'
        : isProblem
        ? '😫 VẤN ĐỀ HAY GẶP'
        : isReveal
        ? '💡 GIẢI PHÁP TỨC THÌ'
        : isDemo
        ? '✨ TRẢI NGHIỆM THỰC TẾ'
        : isPayoff
        ? '🎉 KẾT QUẢ THỎA MÃN'
        : '🛒 TIKTOK SHOP GÓC TRÁI'

      const emphasisWord = seg.emphasis && seg.emphasis[0] ? seg.emphasis[0].toUpperCase() : undefined

      return {
        id: `beat-${idx + 1}`,
        segmentId: seg.segmentId,
        shotType,
        startTimeSec: seg.startSec,
        durationSec: seg.durationSec,
        visualIntent,
        cameraMotion,
        productVisible,
        productRevealDelaySec,
        layers: {
          background: {
            type: 'contextual_environment',
            url: bgUrl,
            transform: bgTransform,
          },
          product: {
            url: currentAsset,
            shadow: true,
            hasContactShadow: true,
            motion: isReveal ? 'snap_pop' : isDemo ? 'macro_slide' : 'subtle_hover',
            transform: productTransform,
          },
          typography: {
            badgeText,
            subtitleText: seg.text,
            emphasisWord,
            emphasisRevealDelaySec: emphasisWord ? 0.5 : undefined,
          },
        },
        sfxCue,
        sfxDelaySec,
      }
    })

    return {
      beats,
      totalDurationSec: totalDuration,
      primaryProductUrl: primaryImg,
      aspectRatio: '9:16',
    }
  }
}
