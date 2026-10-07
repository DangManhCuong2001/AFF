import React from 'react'
import { Composition } from 'remotion'
import { TikTokCommerceVideo } from './TikTokCommerceVideo'
import { RemotionVideoProps } from './types'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokCommerceVideo"
      component={TikTokCommerceVideo as React.ComponentType<any>}
      durationInFrames={450} // 15s default @ 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        beats: [],
        masterAudioUrl: '',
        bgmAudioUrl: '/music/lofi-beat.aac',
        bgmVolume: 0.12,
        sfxCues: [],
        productName: 'Sản phẩm thông minh',
        priceText: '',
        totalDurationFrames: 450,
        fps: 30,
      } as RemotionVideoProps}
    />
  )
}
