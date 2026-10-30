export type VoiceProvider = 'google' | 'elevenlabs' | 'vibi'

export function parseVoiceProvider(value: unknown): VoiceProvider {
  if (value === undefined || value === null || value === '') return 'google'
  if (value === 'google' || value === 'elevenlabs' || value === 'vibi') return value
  throw new Error('Nhà cung cấp giọng đọc không hợp lệ')
}

export function voiceProviderLabel(provider: VoiceProvider): string {
  if (provider === 'elevenlabs') return 'ElevenLabs'
  if (provider === 'vibi') return 'Vibi'
  return 'Google'
}
