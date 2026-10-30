export type VoiceProvider = 'google' | 'elevenlabs' | 'vibi' | 'vibi-capcut'

export function parseVoiceProvider(value: unknown): VoiceProvider {
  if (value === undefined || value === null || value === '') return 'google'
  if (value === 'google' || value === 'elevenlabs' || value === 'vibi' || value === 'vibi-capcut') return value
  throw new Error('Nhà cung cấp giọng đọc không hợp lệ')
}

export function voiceProviderLabel(provider: VoiceProvider): string {
  if (provider === 'elevenlabs') return 'ElevenLabs'
  if (provider === 'vibi') return 'Vibi'
  if (provider === 'vibi-capcut') return 'Vibi CapCut'
  return 'Google'
}
