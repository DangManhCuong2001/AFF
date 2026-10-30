import type {ImageFocus} from '@/engines/planning/types'
import {suggestVidsFrameAspect} from './vids-framing'

export const VIDS_REFERENCE_FRAME = {width: 720, height: 1280} as const

/** Fit the complete source into a portrait canvas without stretching it. */
export function portraitReferenceRect(width: number, height: number, frame = VIDS_REFERENCE_FRAME) {
  if (![width, height, frame.width, frame.height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Kích thước ảnh tham chiếu không hợp lệ.')
  const maxWidth = frame.width * 0.92
  const maxHeight = frame.height * 0.82
  const scale = Math.min(maxWidth / width, maxHeight / height)
  const fittedWidth = Math.round(width * scale), fittedHeight = Math.round(height * scale)
  return {left: Math.round((frame.width - fittedWidth) / 2), top: Math.round((frame.height - fittedHeight) / 2), width: fittedWidth, height: fittedHeight}
}

/** Places an unwarped copy on the same 9:16 canvas requested from Vids. */
export async function frameVidsReferencePortrait(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  try {
    const rect = portraitReferenceRect(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = VIDS_REFERENCE_FRAME.width; canvas.height = VIDS_REFERENCE_FRAME.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không chuẩn bị được khung dọc cho ảnh.')
    context.fillStyle = '#f3f0e9'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, rect.left, rect.top, rect.width, rect.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không tạo được ảnh tham chiếu dọc.')), 'image/png'))
    if (blob.size > 5 * 1024 * 1024) throw new Error('Ảnh tham chiếu dọc lớn hơn 5 MB.')
    return blob
  } finally {bitmap.close()}
}

export async function vidsReferenceFrameAspect(source: Blob): Promise<number | undefined> {
  const bitmap = await createImageBitmap(source)
  try {return suggestVidsFrameAspect(bitmap.width, bitmap.height)} finally {bitmap.close()}
}

export type ReferenceCrop = ImageFocus
export interface PixelCrop {left: number; top: number; width: number; height: number}
export function validReferenceCrop(value?: ReferenceCrop): value is ReferenceCrop {
  return !!value && [value.x, value.y, value.width, value.height].every(Number.isFinite) && value.x >= 0 && value.y >= 0 && value.width > 0 && value.height > 0 && value.x + value.width <= 100.001 && value.y + value.height <= 100.001
}
/** Bounds are a suggestion, with breathing room: never treat AI bounds as a mask. */
export function suggestVidsCrop(bounds?: ImageFocus): ReferenceCrop | undefined {
  if (!validReferenceCrop(bounds)) return undefined
  const px = Math.max(3, bounds.width * 0.1)
  const py = Math.max(3, bounds.height * 0.1)
  const x = Math.max(0, bounds.x - px), y = Math.max(0, bounds.y - py)
  const right = Math.min(100, bounds.x + bounds.width + px)
  const bottom = Math.min(100, bounds.y + bounds.height + py)
  if ((right - x) * (bottom - y) > 9500) return undefined
  return {x, y, width: right - x, height: bottom - y}
}
export function referencePixelCrop(crop: ReferenceCrop, width: number, height: number): PixelCrop {
  if (!validReferenceCrop(crop) || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('Khung cắt ảnh không hợp lệ.')
  const left = Math.floor(crop.x * width / 100), top = Math.floor(crop.y * height / 100)
  const right = Math.min(width, Math.ceil((crop.x + crop.width) * width / 100))
  const bottom = Math.min(height, Math.ceil((crop.y + crop.height) * height / 100))
  return {left, top, width: right - left, height: bottom - top}
}
/** Crops a copy, without resizing or synthesizing pixels. Original Blob is untouched. */
export async function cropVidsReference(source: Blob, crop: ReferenceCrop): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  try {
    const rect = referencePixelCrop(crop, bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = rect.width; canvas.height = rect.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Không chuẩn bị được ảnh cắt.')
    context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không đọc được ảnh cắt.')), 'image/png'))
    if (blob.size > 5 * 1024 * 1024) throw new Error('Ảnh cắt PNG lớn hơn 5 MB. Dùng ảnh sạch nhỏ hơn hoặc giữ ảnh gốc.')
    return blob
  } finally {bitmap.close()}
}
