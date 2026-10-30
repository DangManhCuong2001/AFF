import React from 'react'
import {AbsoluteFill, Img, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion'
import {Video} from '@remotion/media'
import {sceneVideoFrames} from './scene-video'
import type {StoryboardScene} from '../engines/core/types'
import {COMMERCE_LAYOUT as layout, fitCommerceText} from './tiktok-layout'
import {CommerceProductImage} from './CommerceProductImage'
import {captionAtProgress, speechProgressAtTime} from './scene-captions'
import {validVidsFrameAspect, vidsFrameRect} from '../lib/video/vids-framing'
import {dimensionSpecRows} from '../engines/planning/spec-values'
import {activeNarrativeVisual} from '../engines/planning/narrative-visuals'
import {narrationPhraseRange} from '../engines/planning/narrative-timing'

/** One shared safe layout for browser preview, client export and server rendering. */
export const PlannedCommerceScene: React.FC<{scene: StoryboardScene; imageUrl: string; secondaryImageUrl?: string; visualStepImages?: string[]; durationSec: number; video?: import('../lib/video/vids-plan').SceneVideoClip}> = ({scene, imageUrl, secondaryImageUrl, visualStepImages, durationSec, video}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const videoFrames = video ? sceneVideoFrames(video, durationSec, fps) : 0
  const progress = Math.min(1, frame / Math.max(1, durationSec * fps))
  const enter = spring({frame, fps, config: {damping: 23}})
  const plan = scene.renderPlan!
  const contextImage = plan.contextImageUrl
  const cta = scene.type === 'cta'
  const speakingProgress = speechProgressAtTime(frame / fps, durationSec, plan.speechTiming)
  const caption = captionAtProgress(scene.voice || scene.headline, speakingProgress)
  const visualIndex = activeNarrativeVisual(plan.visualSteps, scene.voice, speakingProgress)
  const visualStep = !cta && visualStepImages?.[visualIndex] ? plan.visualSteps?.[visualIndex] : undefined
  const variant = cta ? 'decision' : plan.layout === 'gallery' && !secondaryImageUrl ? 'hero' : plan.layout || 'hero'
  const cardWidth = layout.width
  const contextHero = !!contextImage && (variant === 'hero' || variant === 'decision')
  const hasSubheadline = !visualStep && !contextHero && !!scene.subheadline && scene.subheadline !== scene.headline && variant !== 'spec'
  const imageSlot = visualStep ? {top: 420, height: layout.caption.top - 420 - 24} : cta ? plan.decisionPrompt ? {top: 480, height: 440} : {top: 420, height: 660} : hasSubheadline ? layout.image : {top: 420, height: contextHero ? 688 : 604}
  const cardHeight = imageSlot.height
  const videoFrame = vidsFrameRect(cardWidth, cardHeight, video?.frameAspect)
  const zoom = plan.framing === 'detail' ? 0.98 + speakingProgress * 0.02 : 0.95 + speakingProgress * 0.05
  const emphasis = new Set((scene.keywords || []).flatMap((keyword) => keyword.toLocaleLowerCase('vi').split(/\s+/)))
  const detail = plan.framing === 'detail'
  const subheadline = hasSubheadline ? scene.subheadline : undefined
  const annotation = !visualStep && detail ? plan.annotation : undefined
  const dimensions = dimensionSpecRows(plan.spec?.value || '')
  const dimensionCues = dimensions.map((row, index) => ({index, range: narrationPhraseRange(scene.voice, row.value)}))
  const activeDimension = [...dimensionCues].reverse().find(cue => cue.range && speakingProgress >= cue.range.start)?.index ?? 0
  const box = (slot: {top: number; height: number}): React.CSSProperties => ({position: 'absolute', left: layout.left, width: layout.width, top: slot.top, height: slot.height})
  const copyStyle = (text: string, height: number, font: number, width = layout.width): React.CSSProperties => ({fontSize: fitCommerceText(text, width, height, font), lineHeight: 1.2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap'})
  return <AbsoluteFill style={{background: '#f5f2eb', color: '#252922', fontFamily: 'Arial, sans-serif'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 65% 45%, #ffffff 0%, #f5f2eb 72%)'}} />
    {contextImage && <>
      <Img src={contextImage} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px)', transform: 'scale(1.1)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, #f5f2ebf5 12%, #f5f2ebb0 32%, #f5f2eb80 52%, #f5f2ebf5 70%)'}} />
    </>}
    <div style={{...box(layout.label), zIndex: 2, display: 'flex', justifyContent: 'space-between', fontSize: 20, letterSpacing: 2, color: '#8c664a'}}>
      <span>{cta ? 'CHỌN MUA' : detail ? 'CẬN CẢNH' : 'ĐIỂM ĐÁNG CHÚ Ý'}</span><span>{detail ? 'CHI TIẾT SẢN PHẨM' : cta ? 'XEM TRONG GIỎ HÀNG' : 'NHÌN GẦN HƠN'}</span>
    </div>
    <div style={{...box(layout.headline), zIndex: 2, display: 'flex', alignItems: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 10}px)`}}>
      <div style={{...copyStyle(scene.headline, layout.headline.height, 52), fontWeight: 800, letterSpacing: -0.8}}>{scene.headline}</div>
    </div>
    {subheadline && <div style={{...box(layout.subheadline), zIndex: 2, ...copyStyle(subheadline, layout.subheadline.height, 27, layout.width - 32), color: '#6e665b', background: plan.evidenceIds.length ? '#eee6d8' : undefined, borderRadius: 12, padding: plan.evidenceIds.length ? '0 16px' : undefined, boxSizing: 'border-box', display: 'flex', alignItems: 'center'}}>{subheadline}</div>}
    <div style={{...box(imageSlot), borderRadius: 28, overflow: 'hidden', background: '#fff', boxShadow: '0 18px 50px #3a291b24', transform: `translateY(${(1 - enter) * 16}px)`, border: '1px solid #ffffffbb'}}>
      {video && videoFrames > 0 && <Sequence durationInFrames={videoFrames} name="Vids clip">
        <AbsoluteFill style={{zIndex: 3, background: '#f8f6f1'}}>
          <div style={{position: 'absolute', ...videoFrame, overflow: 'hidden'}}><Video src={video.src} muted playbackRate={1} objectFit={validVidsFrameAspect(video.frameAspect) ? 'cover' : 'contain'} style={{width: '100%', height: '100%'}} /></div>
        </AbsoluteFill>
      </Sequence>}
      {visualStep ? <div style={{padding: 16}}>
        <CommerceProductImage key={`${visualStep.assetId}:${JSON.stringify(visualStep.crop)}`} src={visualStepImages![visualIndex]} width={cardWidth - 32} height={cardHeight - 100} zoom={zoom} />
        <div style={{height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', ...copyStyle(visualStep.label, 64, 30, cardWidth - 72), fontWeight: 700, color: '#8c664a'}}>{visualStep.label}</div>
      </div> : contextHero ? <>
        <Img src={contextImage!} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px)', opacity: 0.35}} />
        <CommerceProductImage src={contextImage!} width={cardWidth} height={cardHeight} zoom={zoom} />
        <div style={{position: 'absolute', right: 16, bottom: 16, width: 204, height: 220, background: '#fffffff5', border: '1px solid #eee6d8', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 24px #25292225'}}>
          <CommerceProductImage src={imageUrl} width={204} height={184} crop={plan.crop} />
          <div style={{fontSize: 16, color: '#6e665b', textAlign: 'center'}}>CHI TIẾT SẢN PHẨM</div>
        </div>
      </> : variant === 'gallery' && secondaryImageUrl ? <div style={{display: 'flex', gap: 16, padding: 16}}>
        {[{src: imageUrl, width: 432, crop: plan.crop, label: 'ẢNH 1'}, {src: secondaryImageUrl, width: cardWidth - 480, crop: plan.secondaryAsset?.crop, label: 'ẢNH 2'}].map((item) => <div key={item.label} style={{width: item.width, borderRadius: 18, background: '#f8f6f1', overflow: 'hidden'}}>
          <CommerceProductImage src={item.src} width={item.width} height={cardHeight - 84} zoom={zoom} />
          <div style={{height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c664a', fontSize: 18, letterSpacing: 1.5}}>{item.label}</div>
        </div>)}
      </div> : variant === 'detail' ? <div style={{display: 'flex', gap: 16, padding: 16}}>
        <div style={{width: 260, borderRadius: 18, background: '#f8f6f1', overflow: 'hidden'}}>
          <CommerceProductImage src={imageUrl} width={260} height={cardHeight - 84} crop={plan.fullProductCrop} />
          <div style={{height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c664a', fontSize: 18, letterSpacing: 1}}>VỊ TRÍ CHI TIẾT</div>
        </div>
        <div style={{width: cardWidth - 308, border: '2px solid #ca773955', borderRadius: 18, overflow: 'hidden', boxSizing: 'border-box'}}>
          <CommerceProductImage src={imageUrl} width={cardWidth - 312} height={cardHeight - 88} crop={plan.crop} zoom={zoom} />
          <div style={{height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c664a', fontSize: 18, letterSpacing: 1.5}}>CẬN CẢNH</div>
        </div>
      </div> : variant === 'spec' && plan.spec ? <div style={{display: 'flex', alignItems: 'center', height: '100%', padding: 16, gap: 16, boxSizing: 'border-box'}}>
        <CommerceProductImage src={imageUrl} width={390} height={cardHeight - 32} zoom={zoom} />
        <div style={{width: cardWidth - 438, minHeight: cardHeight - 80, borderRadius: 20, background: '#eee6d8', padding: 22, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20}}>
          <div style={{...copyStyle(plan.spec.label, 64, 22, cardWidth - 482), color: '#8c664a'}}>{plan.spec.label}</div>
          {dimensions.length >= 2 ? <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>{dimensions.map((row, index) => <div key={row.label} style={{padding: '14px 16px', borderRadius: 14, background: '#fff9', border: `2px solid ${index === activeDimension ? '#ca7739' : '#ffffff00'}`}}>
            <div style={{fontSize: 22, color: '#8c664a', marginBottom: 6}}>{row.label}</div>
            <div style={{...copyStyle(row.value, 66, 42, cardWidth - 518), fontWeight: 800}}>{row.value}</div>
          </div>)}</div> : <div style={{...copyStyle(plan.spec.value, cardHeight - 228, 40, cardWidth - 482), fontWeight: 800}}>{plan.spec.value}</div>}
        </div>
      </div> : <CommerceProductImage src={imageUrl} width={cardWidth} height={cardHeight} zoom={zoom} />}

    </div>
    {annotation && <div style={{...box(layout.annotation), display: 'flex', gap: 12, alignItems: 'center', color: '#8c664a'}}><span style={{width: 8, height: 8, borderRadius: 8, background: '#ca7739', flexShrink: 0}} /><span style={copyStyle(annotation, layout.annotation.height, 23, layout.width - 20)}>{annotation}</span></div>}
    {cta && plan.decisionPrompt && <div style={{...box({top: 944, height: 136}), borderRadius: 18, background: '#eee6d8', padding: '12px 18px', boxSizing: 'border-box'}}>
      <div style={{fontSize: 18, fontWeight: 700, color: '#8c664a', letterSpacing: 1.5, marginBottom: 8}}>TRƯỚC KHI ĐẶT</div>
      <div style={copyStyle(plan.decisionPrompt, 84, 29, layout.width - 36)}>{plan.decisionPrompt}</div>
    </div>}
    {cta && <div style={{...box(layout.cta), ...copyStyle(plan.ctaLabel || 'Xem chi tiết sản phẩm', layout.cta.height - 20, 25, layout.width - 40), borderRadius: 16, padding: '10px 20px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#252922', fontWeight: 700}}>{plan.ctaLabel || 'Xem chi tiết sản phẩm'}</div>}
    <div style={{...box(layout.caption), display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <span style={{...copyStyle(caption, layout.caption.height - 16, 29, layout.width - 48), display: 'inline-block', background: '#252922', color: '#fff', borderRadius: 12, padding: '8px 16px'}}>{caption.split(/\s+/).map((word, index) => <React.Fragment key={index}>{index > 0 && ' '}<span style={emphasis.has(word.toLocaleLowerCase('vi').replace(/[.,!?;:]$/, '')) ? {color: '#ffd49d', fontWeight: 800} : undefined}>{word}</span></React.Fragment>)}</span>
    </div>
    <div style={{...box(layout.progress), background: '#25292222'}}><div style={{width: `${progress * 100}%`, height: '100%', background: '#ca7739'}} /></div>
  </AbsoluteFill>
}
