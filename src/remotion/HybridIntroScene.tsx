import React from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import {Video} from '@remotion/media'
import type {SceneVideoClip} from '../lib/video/vids-plan'
import type {StoryplanBeat} from './remotion-types'
import {COMMERCE_LAYOUT as layout, fitCommerceText} from './tiktok-layout'
import {captionAtProgress, speechProgressAtTime} from './scene-captions'
import {vidsPresentationRect} from '../lib/video/vids-framing'

/** A single video instance keeps action continuous while narration beats change. */
export function HybridIntroScene({clip, beats, productName, durationFrames}: {clip: SceneVideoClip; beats: StoryplanBeat[]; productName: string; durationFrames: number}) {
  const frame = useCurrentFrame(), {fps} = useVideoConfig()
  const time = frame / fps
  const beat = [...beats].reverse().find(beat => beat.startTimeSec <= time) || beats[0]
  const scene = beat?.plannedScene
  const headline = scene?.headline || beat?.headline || productName
  const voice = scene?.voice || beat?.layers.typography.subtitleText || headline
  const progress = speechProgressAtTime(Math.max(0, time - (beat?.startTimeSec || 0)), beat?.durationSec || clip.durationSec, scene?.renderPlan?.speechTiming)
  const caption = captionAtProgress(voice, progress)
  // Keep the complete approach path below the heading. A gradient over the
  // source hid hands entering from above, precisely where top access matters.
  const videoTop = layout.headline.top + layout.headline.height + 20
  const videoHeight = layout.caption.top - videoTop - 16
  const videoFrame = vidsPresentationRect(layout.width, videoHeight, clip.frameAspect)
  return <AbsoluteFill style={{zIndex: 50, isolation: 'isolate', opacity: Math.min(1, (durationFrames - frame) / Math.max(1, Math.round(fps * 0.16))), background: '#f5f2eb', color: '#252922', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', left: layout.left, top: videoTop, width: layout.width, height: videoHeight, borderRadius: 28, overflow: 'hidden', background: '#eee8df', boxShadow: '0 18px 50px #3a291b24'}}>
      <div style={{position: 'absolute', ...videoFrame, overflow: 'hidden'}}><Video src={clip.src} muted playbackRate={1} objectFit="cover" style={{width: '100%', height: '100%'}} /></div>
    </div>
    <div style={{position: 'absolute', left: layout.left + 20, top: layout.label.top, width: layout.width - 40, height: 34, color: '#8c664a', fontSize: fitCommerceText(productName, layout.width - 40, 34, 18), lineHeight: 1.2}}>{productName}</div>
    <div style={{position: 'absolute', left: layout.left + 20, top: layout.headline.top, width: layout.width - 40, height: layout.headline.height, fontSize: fitCommerceText(headline, layout.width - 40, layout.headline.height, 46), lineHeight: 1.2, fontWeight: 800, display: 'flex', alignItems: 'center'}}>{headline}</div>
    <div style={{position: 'absolute', left: layout.left, top: layout.caption.top, width: layout.width, height: layout.caption.height, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={{fontSize: fitCommerceText(caption, layout.width - 48, layout.caption.height - 16, 29), lineHeight: 1.2, textAlign: 'center', padding: '8px 16px', borderRadius: 12, background: '#252922', color: '#fff'}}>{caption}</span></div>
  </AbsoluteFill>
}
