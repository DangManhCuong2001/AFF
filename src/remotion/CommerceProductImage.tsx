import React, {useState} from 'react'
import {Img, cancelRender, continueRender, delayRender} from 'remotion'
import type {ImageFocus} from '../engines/planning/types'

/** Contain the chosen source region; zoom never cuts off its edges. */
export const CommerceProductImage: React.FC<{src: string; width: number; height: number; crop?: ImageFocus; zoom?: number; highlight?: ImageFocus}> = ({src, width, height, crop = {x: 0, y: 0, width: 100, height: 100}, zoom = 1, highlight}) => {
  const [size, setSize] = useState({width: 1, height: 1})
  const [handle] = useState(() => delayRender('Loading commerce source image'))
  const cropWidth = size.width * crop.width / 100
  const cropHeight = size.height * crop.height / 100
  const scale = Math.min((width - 24) / cropWidth, (height - 24) / cropHeight) * Math.min(1, zoom)
  const regionWidth = cropWidth * scale, regionHeight = cropHeight * scale
  const loaded = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    setSize({width: image.naturalWidth, height: image.naturalHeight})
    continueRender(handle)
  }
  return <div style={{position: 'relative', width, height, overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: (width - regionWidth) / 2, top: (height - regionHeight) / 2, width: regionWidth, height: regionHeight, overflow: 'hidden', borderRadius: 8}}>
      <Img src={src} onLoad={loaded} onError={() => cancelRender(new Error('Không tải được ảnh sản phẩm cho cảnh này'))}
        style={{position: 'absolute', maxWidth: 'none', width: size.width * scale, height: size.height * scale, left: -size.width * crop.x / 100 * scale, top: -size.height * crop.y / 100 * scale}} />
      {highlight && <div style={{position: 'absolute', left: (highlight.x - crop.x) / crop.width * regionWidth, top: (highlight.y - crop.y) / crop.height * regionHeight, width: highlight.width / crop.width * regionWidth, height: highlight.height / crop.height * regionHeight, border: '3px solid #ca7739', background: '#ca77390c', boxSizing: 'border-box', borderRadius: 6}} />}
    </div>
  </div>
}
