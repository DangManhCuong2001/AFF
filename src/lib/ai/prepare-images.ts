import type { ProductAsset } from '@/engines/core/types'
import { isProductImage } from '@/engines/planning/AdaptiveVideoPlanner'
import type { AnalysisImage } from './gemini'

/** Encode in the browser so local uploads and CORS-accessible remote photos reach vision. */
export async function prepareAnalysisImages(assets: ProductAsset[]): Promise<AnalysisImage[]> {
  const images = assets.filter(isProductImage)
  const primary = images.find((image) => image.isPrimary)
  const selected = (primary ? [primary, ...images.filter((image) => image !== primary)] : images).slice(0, 3)
  const results = await Promise.allSettled(selected.map(async (asset) => {
    const blob = asset.file || await fetch(asset.url, {signal: AbortSignal.timeout(8000)}).then((response) => {
      if (!response.ok) throw new Error('Image unavailable')
      return response.blob()
    })
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
