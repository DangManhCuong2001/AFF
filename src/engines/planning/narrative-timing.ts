import {normalizeVietnameseNumbers} from '../../lib/audio/speech-normalization'

const unit = /^(mm|cm|ml|kg|GB|m|l|g|W)[,;.!?]?$/u
const number = /\d[\d.,]*$/u
const weight = (text: string) => normalizeVietnameseNumbers(text).split(/\s+/).reduce((sum, word) => sum + Math.max(2, word.length), 0)
const key = (text: string) => text.toLocaleLowerCase('vi').normalize('NFC').replace(/[^\p{L}\p{N}.,]/gu, '').replace(/[.,]+$/u, '')

/** Estimated pronunciation weights, not forced alignment of actual audio. */
export function narrationWords(text: string) {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const weights = tokens.map((token, index) => unit.test(token) && index > 0 && number.test(tokens[index - 1])
    ? Math.max(2, weight(`${tokens[index - 1]} ${token}`) - weight(tokens[index - 1])) : weight(token))
  const total = weights.reduce((sum, value) => sum + value, 0) || 1
  let cursor = 0
  return tokens.map((token, index) => {const start = cursor / total; cursor += weights[index]; return {text: token, start, end: cursor / total, weight: weights[index]}})
}

/** Only an unambiguous, complete quoted phrase may schedule a visual step. */
export function narrationPhraseRange(text: string, phrase: string): {start: number; end: number} | undefined {
  const tokens = narrationWords(text), sought = phrase.trim().split(/\s+/).filter(Boolean).map(key)
  if (!sought.length || sought.some(value => !value)) return undefined
  const matches = tokens.flatMap((_token, index) => sought.every((word, offset) => key(tokens[index + offset]?.text || '') === word) ? [index] : [])
  if (matches.length !== 1) return undefined
  const index = matches[0]
  return {start: tokens[index].start, end: tokens[index + sought.length - 1].end}
}
