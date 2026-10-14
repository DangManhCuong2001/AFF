export type VoiceProvider = 'google' | 'elevenlabs'

export function parseVoiceProvider(value: unknown): VoiceProvider {
  if (value === undefined || value === null || value === '') return 'google'
  if (value === 'google' || value === 'elevenlabs') return value
  throw new Error('Nhà cung cấp giọng đọc không hợp lệ')
}
