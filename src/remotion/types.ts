import { VisualBeat } from '@/engines/visual/types'

export interface RemotionVideoProps {
  beats: VisualBeat[]
  masterAudioUrl: string
  bgmAudioUrl?: string
  bgmVolume?: number
  sfxCues?: Array<{
    id: string
    name?: string
    url: string
    timestampSec: number
    volume: number
  }>
  productName: string
  priceText?: string
  totalDurationFrames: number
  fps: number
}
