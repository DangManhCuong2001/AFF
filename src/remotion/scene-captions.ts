/** Phrase-sized captions with estimated pacing; no claim of word-level audio alignment. */
export function buildCaptionCues(text: string) {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const groups: string[][] = []
  let current: string[] = []
  for (const token of tokens) {
    current.push(token)
    if (current.length >= 7 || (current.length >= 3 && /[.!?,;:]$/.test(token))) {
      groups.push(current)
      current = []
    }
  }
  if (current.length) groups.push(current)
  const weights = groups.map((group) => group.reduce((sum, token) => sum + Math.max(2, token.length), 0))
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let cursor = 0
  return groups.map((group, index) => {
    const start = cursor / total
    cursor += weights[index]
    return {text: group.join(' '), start, end: cursor / total}
  })
}

export function captionAtProgress(text: string, progress: number): string {
  const cues = buildCaptionCues(text)
  return cues.find((cue) => Math.max(0, progress) < cue.end)?.text || cues.at(-1)?.text || ''
}

/** Phrase timing is estimated within the measured speaking window, excluding holds. */
export function speechProgressAtTime(timeSec: number, sceneDuration: number, timing?: {offsetSec: number; durationSec: number}): number {
  const offset = timing?.offsetSec ?? 0
  const duration = timing?.durationSec ?? sceneDuration
  return Math.max(0, Math.min(1, (timeSec - offset) / Math.max(0.01, duration)))
}
