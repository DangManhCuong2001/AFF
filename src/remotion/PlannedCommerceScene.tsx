import React, {useState} from 'react'
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion'
import type {StoryboardScene} from '../engines/core/types'

/** Renders the planner's scene directly, without catalog claims or invented offers. */
export const PlannedCommerceScene: React.FC<{scene: StoryboardScene; imageUrl: string; durationSec: number}> = ({scene, imageUrl, durationSec}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const [size, setSize] = useState({width: 1, height: 1})
  const [handle] = useState(() => delayRender('Loading planned product image'))
  const progress = Math.min(1, frame / Math.max(1, durationSec * fps))
  const enter = spring({frame, fps, config: {damping: 23}})
  const plan = scene.renderPlan!
  const crop = plan.crop || {x: 0, y: 0, width: 100, height: 100}
  const cropWidth = size.width * crop.width / 100
  const cropHeight = size.height * crop.height / 100
  const cardWidth = 896
  const cardHeight = 940
  const scale = Math.min(cardWidth / cropWidth, cardHeight / cropHeight) * (1 + progress * (plan.framing === 'detail' ? 0.055 : 0.025))
  const voiceWords = scene.voice.trim().split(/\s+/)
  const groupSize = Math.max(1, Math.ceil(voiceWords.length / Math.ceil(voiceWords.length / 7)))
  const captions = Array.from({length: Math.ceil(voiceWords.length / groupSize)}, (_, index) => voiceWords.slice(index * groupSize, (index + 1) * groupSize).join(' '))
  const caption = captions[Math.min(captions.length - 1, Math.floor(progress * captions.length))]
  const cta = scene.type === 'cta'
  const detail = plan.framing === 'detail'
  const contextImage = plan.contextImageUrl
  const color = contextImage ? '#fff' : '#252922'
  const imageLoaded = (event: React.SyntheticEvent<HTMLImageElement>) => {const image = event.currentTarget; setSize({width: image.naturalWidth, height: image.naturalHeight}); continueRender(handle)}
  return <AbsoluteFill style={{background: '#f5f2eb', color: '#252922', fontFamily: 'Arial, sans-serif'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 70% 55%, #ffffff 0%, #f5f2eb 72%)'}} />
    {contextImage && <>
      <Img src={contextImage} onLoad={imageLoaded} onError={() => cancelRender(new Error('Không tải được ảnh bối cảnh'))} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1.025 + progress * 0.055})`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, #181c17bb 0%, #181c1755 25%, transparent 45%, transparent 62%, #181c1788 82%, #181c17cc 100%)'}} />
    </>}
    <div style={{position: 'absolute', left: 78, right: 160, top: 115, display: 'flex', justifyContent: 'space-between', fontSize: 24, color: contextImage ? '#f3d4ad' : '#8c664a'}}>
      <span>VIPEE</span>{!contextImage && <span>{detail ? 'CHI TIẾT SẢN PHẨM' : cta ? 'XEM THÊM' : 'ẢNH SẢN PHẨM'}</span>}
    </div>
    <div style={{position: 'absolute', left: 78, right: 165, top: 220, opacity: enter, color, transform: `translateY(${(1 - enter) * 18}px)`}}>
      <div style={{fontSize: 67, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1.5}}>{scene.headline}</div>
      {scene.subheadline && scene.subheadline !== scene.headline && <div style={{marginTop: 22, fontSize: 29, lineHeight: 1.4, color: contextImage ? '#f3d4ad' : '#6e665b'}}>{scene.subheadline}</div>}
    </div>
    {!contextImage && <div style={{position: 'absolute', left: 68, top: 545, width: cardWidth, height: cardHeight, borderRadius: 34, overflow: 'hidden', background: '#fff', boxShadow: '0 22px 60px #3a291b12'}}>
      <div style={{position: 'absolute', left: (cardWidth - cropWidth * scale) / 2, top: (cardHeight - cropHeight * scale) / 2, width: cropWidth * scale, height: cropHeight * scale, overflow: 'hidden'}}>
        <Img src={imageUrl} onLoad={imageLoaded} onError={() => cancelRender(new Error('Không tải được ảnh sản phẩm cho cảnh này'))}
          style={{position: 'absolute', maxWidth: 'none', width: size.width * scale, height: size.height * scale, left: -size.width * crop.x / 100 * scale, top: -size.height * crop.y / 100 * scale}} />
      </div>
    </div>}
    {plan.annotation && detail && <div style={{position: 'absolute', top: 1505, left: 88, right: 170, display: 'flex', gap: 15, alignItems: 'center', fontSize: 26, color: '#8c664a'}}><span style={{width: 10, height: 10, borderRadius: 10, background: '#ca7739', flexShrink: 0}} />{plan.annotation}</div>}
    {cta && <div style={{position: 'absolute', top: 1510, left: 78, right: 165, borderRadius: 20, padding: '23px 28px', color: '#fff', background: '#252922', fontSize: 29, fontWeight: 700}}>Xem lựa chọn trong giỏ hàng ↗</div>}
    <div style={{position: 'absolute', bottom: 170, left: 88, right: 170, textAlign: 'center'}}>
      <span style={{display: 'inline-block', background: '#252922', color: '#fff', borderRadius: 15, padding: '17px 23px', fontSize: 34, lineHeight: 1.35}}>{caption}</span>
    </div>
    <div style={{position: 'absolute', bottom: 130, left: 88, right: 170, height: 4, background: '#25292222'}}><div style={{width: `${interpolate(progress, [0, 1], [0, 100])}%`, height: '100%', background: '#ca7739'}} /></div>
  </AbsoluteFill>
}
