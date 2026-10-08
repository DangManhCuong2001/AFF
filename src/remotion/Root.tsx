import React from 'react'
import { Composition } from 'remotion'
import { TikTokCommerceVideo } from './TikTokCommerceVideo'
import { RemotionVideoProps } from './types'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokCommerceVideo"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={TikTokCommerceVideo as React.ComponentType<any>}
      durationInFrames={450} // 15s default @ 30fps
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={({ defaultProps, props }) => {
        const merged = { ...defaultProps, ...props } as unknown as RemotionVideoProps
        return {
          durationInFrames: merged.totalDurationFrames || 450,
          fps: merged.fps || 30,
        }
      }}
      defaultProps={{
        beats: [],
        masterAudioUrl: '',
        bgmAudioUrl: '/music/lofi-beat.mp3',
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
