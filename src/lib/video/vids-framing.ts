/** Optional, reviewed framing. Full source remains the default. */
export function validVidsFrameAspect(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 2
}
export function suggestVidsFrameAspect(width: number, height: number): number | undefined {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) return undefined
  // Match the reference proportions with breathing room. This is a proposal,
  // not subject detection: the user must check the whole moving clip.
  const aspect = Math.min(1.25, Math.max(9 / 16, width / height / 1.08))
  return Math.round(aspect * 10000) / 10000
}
export function vidsFrameRect(width: number, height: number, frameAspect?: number) {
  if (!validVidsFrameAspect(frameAspect)) return {left: 0, top: 0, width, height}
  const w = Math.min(width, height * frameAspect), h = w / frameAspect
  return {left: (width - w) / 2, top: (height - h) / 2, width: w, height: h}
}

/** Widen portrait footage with a restrained top/bottom presentation crop. */
export function vidsPresentationRect(width: number, height: number, frameAspect?: number) {
  const aspect = validVidsFrameAspect(frameAspect) ? Math.max(0.72, frameAspect) : 0.72
  const fittedWidth = Math.min(width, height * aspect)
  const fittedHeight = fittedWidth / aspect
  return {left: (width - fittedWidth) / 2, top: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight}
}
export function vidsSourceCrop(width: number, height: number, frameAspect?: number) {
  const rect = vidsFrameRect(width, height, frameAspect)
  // For a source image, fit the selected ratio inside its original bounds.
  return {x: rect.left, y: rect.top, width: rect.width, height: rect.height}
}
