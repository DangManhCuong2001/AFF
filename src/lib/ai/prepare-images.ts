import type { ProductAsset } from '@/engines/core/types'
import { isProductImage } from '@/engines/planning/AdaptiveVideoPlanner'
import type { AnalysisImage } from './gemini'
import {isAllowedProductImageUrl} from './remote-image-url'

/** Reuse the same readable source for vision, browser export and server export. */
export async function loadProductImageBlob(asset: ProductAsset): Promise<Blob> {
  if (asset.file) return asset.file
  try {
    const response = await fetch(asset.url, {signal: AbortSignal.timeout(8000)})
    if (!response.ok) throw new Error('Image unavailable')
    return await response.blob()
  } catch (error) {
    if (!isAllowedProductImageUrl(asset.url)) throw error
    const response = await fetch('/api/assets/analysis-image', {
      method: 'POST', signal: AbortSignal.timeout(12000), headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: asset.url}),
    })
    if (!response.ok) throw new Error('Image unavailable')
    return response.blob()
  }
}

/** Encode in the browser so local uploads and CORS-accessible remote photos reach vision. */
export async function prepareAnalysisImages(assets: ProductAsset[]): Promise<AnalysisImage[]> {
  const images = assets.filter(isProductImage)
  const primary = images.find((image) => image.isPrimary)
  const selected = (primary ? [primary, ...images.filter((image) => image !== primary)] : images).slice(0, 3)
  const results = await Promise.allSettled(selected.map(async (asset) => {
    const blob = await loadProductImageBlob(asset)
    if (!blob) throw new Error('Image unavailable')
    const bitmap = await createImageBitmap(blob)
    try {
      const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return {assetId: asset.id, dataUrl: canvas.toDataURL('image/jpeg', 0.8)}
    } finally { bitmap.close() }
  }))
  return results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
}
