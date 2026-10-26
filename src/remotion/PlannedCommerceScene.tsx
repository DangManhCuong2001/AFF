import React, {useState} from 'react'
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, spring, useCurrentFrame, useVideoConfig} from 'remotion'
import type {StoryboardScene} from '../engines/core/types'
import {COMMERCE_LAYOUT as layout, fitCommerceText} from './tiktok-layout'

/** One shared safe layout for browser preview, client export and server rendering. */
export const PlannedCommerceScene: React.FC<{scene: StoryboardScene; imageUrl: string; durationSec: number}> = ({scene, imageUrl, durationSec}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const [size, setSize] = useState({width: 1, height: 1})
  const [handle] = useState(() => delayRender('Loading planned product image'))
  const progress = Math.min(1, frame / Math.max(1, durationSec * fps))
  const enter = spring({frame, fps, config: {damping: 23}})
  const plan = scene.renderPlan!
  const contextImage = plan.contextImageUrl
  const displayedImage = contextImage || imageUrl
  // Contexts show the complete generated photo; only source detail scenes use a planned crop.
  const crop = (!contextImage && plan.crop) || {x: 0, y: 0, width: 100, height: 100}
  const cropWidth = size.width * crop.width / 100
  const cropHeight = size.height * crop.height / 100
  const cardWidth = layout.width
  const imageSlot = contextImage ? {top: 280, height: 820} : layout.image
  const cardHeight = imageSlot.height
  const scale = Math.min((cardWidth - 32) / cropWidth, (cardHeight - 32) / cropHeight) * (0.96 + progress * 0.04)
  const voiceWords = (scene.voice || scene.headline).trim().split(/\s+/).filter(Boolean)
  const captions = Array.from({length: Math.ceil(voiceWords.length / 7)}, (_, index) => voiceWords.slice(index * 7, index * 7 + 7).join(' '))
  const caption = captions[Math.min(captions.length - 1, Math.floor(progress * captions.length))] || ''
  const cta = scene.type === 'cta'
  const detail = plan.framing === 'detail'
  const subheadline = scene.subheadline !== scene.headline ? scene.subheadline : undefined
  const annotation = detail ? plan.annotation : undefined
  const imageLoaded = (event: React.SyntheticEvent<HTMLImageElement>) => {const image = event.currentTarget; setSize({width: image.naturalWidth, height: image.naturalHeight}); continueRender(handle)}
  const box = (slot: {top: number; height: number}): React.CSSProperties => ({position: 'absolute', left: layout.left, width: layout.width, top: slot.top, height: slot.height})
  const copyStyle = (text: string, height: number, font: number, width = layout.width): React.CSSProperties => ({fontSize: fitCommerceText(text, width, height, font), lineHeight: 1.2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap'})
  return <AbsoluteFill style={{background: '#f5f2eb', color: '#252922', fontFamily: 'Arial, sans-serif'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 65% 45%, #ffffff 0%, #f5f2eb 72%)'}} />
    {contextImage && <>
      <Img src={contextImage} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px)', transform: 'scale(1.1)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, #f5f2ebf5, #f5f2ebdb 50%, #f5f2ebf5)'}} />
    </>}
    <div style={{...box(layout.label), zIndex: 2, display: 'flex', justifyContent: 'space-between', fontSize: 20, letterSpacing: 2, color: '#8c664a'}}>
      <span>VIPEE</span><span>{detail ? 'GÓC NHÌN CHI TIẾT' : cta ? 'CHỌN MẪU PHÙ HỢP' : 'KHÁM PHÁ SẢN PHẨM'}</span>
    </div>
    <div style={{...box(layout.headline), zIndex: 2, display: 'flex', alignItems: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 10}px)`}}>
      <div style={{...copyStyle(scene.headline, layout.headline.height, 52), fontWeight: 800, letterSpacing: -0.8}}>{scene.headline}</div>
    </div>
    {subheadline && <div style={{...box(layout.subheadline), zIndex: 2, ...copyStyle(subheadline, layout.subheadline.height, 27), color: '#6e665b', display: 'flex', alignItems: 'center'}}>{subheadline}</div>}
    <div style={{...box(imageSlot), borderRadius: 28, overflow: 'hidden', background: '#fff', boxShadow: '0 16px 50px #3a291b12', border: '1px solid #ffffffbb'}}>
      {contextImage && <><Img src={contextImage} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px)', opacity: 0.22, transform: 'scale(1.15)'}} /><AbsoluteFill style={{background: '#ffffff55'}} /></>}
      <div style={{position: 'absolute', left: (cardWidth - cropWidth * scale) / 2, top: (cardHeight - cropHeight * scale) / 2, width: cropWidth * scale, height: cropHeight * scale, overflow: 'hidden', borderRadius: contextImage ? 12 : 0}}>
        <Img src={displayedImage} onLoad={imageLoaded} onError={() => cancelRender(new Error('Không tải được ảnh sản phẩm cho cảnh này'))}
          style={{position: 'absolute', maxWidth: 'none', width: size.width * scale, height: size.height * scale, left: -size.width * crop.x / 100 * scale, top: -size.height * crop.y / 100 * scale}} />
      </div>
      {contextImage && <div style={{position: 'absolute', inset: '0 0 auto', height: 200, background: 'linear-gradient(180deg, #f5f2ebf5, #f5f2ebbb 65%, transparent)'}} />}
    </div>
    {annotation && <div style={{...box(layout.annotation), display: 'flex', gap: 12, alignItems: 'center', color: '#8c664a'}}><span style={{width: 8, height: 8, borderRadius: 8, background: '#ca7739', flexShrink: 0}} /><span style={copyStyle(annotation, layout.annotation.height, 23, layout.width - 20)}>{annotation}</span></div>}
    {cta && <div style={{...box(layout.cta), borderRadius: 16, padding: '10px 20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#252922', fontSize: 25, fontWeight: 700}}>Xem lựa chọn trong giỏ hàng</div>}
    <div style={{...box(layout.caption), display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <span style={{...copyStyle(caption, layout.caption.height - 16, 29, layout.width - 48), display: 'inline-block', background: '#252922', color: '#fff', borderRadius: 12, padding: '8px 16px'}}>{caption}</span>
    </div>
    <div style={{...box(layout.progress), background: '#25292222'}}><div style={{width: `${progress * 100}%`, height: '100%', background: '#ca7739'}} /></div>
  </AbsoluteFill>
}
