const VIBI_API_BASE_URL = 'https://api.vibi.pro'
const DEFAULT_POLL_INTERVAL_MS = 800
const DEFAULT_TIMEOUT_MS = 45_000

export type VibiUpstreamProvider = 'elevenlabs' | 'minimax' | 'capcut'

interface VibiTTSOptions {
  pollIntervalMs?: number
  timeoutMs?: number
  upstreamProvider?: VibiUpstreamProvider
}

interface VibiTaskResponse {
  id?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  result?: {audio_url?: string}
  error?: unknown
}

function configuredUpstream(): VibiUpstreamProvider {
  const value = process.env.VIBI_UPSTREAM_PROVIDER?.trim().toLowerCase() || 'elevenlabs'
  if (value === 'elevenlabs' || value === 'minimax' || value === 'capcut') return value
  throw new Error('VIBI_UPSTREAM_PROVIDER chỉ nhận elevenlabs, minimax hoặc capcut')
}

async function jsonResponse(response: Response): Promise<VibiTaskResponse> {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) as VibiTaskResponse } catch { return {error: text.slice(0, 300)} }
}

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 300)
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value).slice(0, 300) } catch { return 'Lỗi không xác định' }
  }
  return 'Lỗi không xác định'
}

function requestBody(text: string, upstream: VibiUpstreamProvider) {
  if (upstream === 'capcut') {
    return {text, provider: 'capcut', model_id: 'capcut', language_code: 'vi', voice_settings: {speed: 1, pitch: 0}}
  }
  if (upstream === 'minimax') {
    return {text, provider: 'minimax', model_id: process.env.VIBI_MODEL_ID?.trim() || 'speech-2.8-turbo', language_code: 'Vietnamese', voice_settings: {speed: 1, pitch: 0, vol: 1}}
  }
  return {
    text,
    provider: 'elevenlabs',
    model_id: process.env.VIBI_MODEL_ID?.trim() || 'eleven_v4',
    language_code: 'vi',
    voice_settings: {stability: 0.44, similarity_boost: 0.8, speed: 1.1},
  }
}

/** Generate one narration segment through Vibi without exposing its API key. */
export async function generateVibiTTS(text: string, options?: VibiTTSOptions): Promise<Buffer> {
  const apiKey = process.env.VIBI_API_KEY?.trim()
  const upstream = options?.upstreamProvider ?? configuredUpstream()
  const voiceId = upstream === 'capcut'
    ? process.env.VIBI_CAPCUT_VOICE_ID?.trim() || (configuredUpstream() === 'capcut' ? process.env.VIBI_DEFAULT_VOICE_ID?.trim() : '')
    : process.env.VIBI_DEFAULT_VOICE_ID?.trim()
  if (!apiKey) throw new Error('Chưa cấu hình VIBI_API_KEY')
  if (!voiceId) {
    throw new Error(upstream === 'capcut' ? 'Chưa cấu hình VIBI_CAPCUT_VOICE_ID' : 'Chưa cấu hình VIBI_DEFAULT_VOICE_ID')
  }
  const endpoint = `${VIBI_API_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const createdResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {'xi-api-key': apiKey, 'Content-Type': 'application/json'},
    body: JSON.stringify(requestBody(text, upstream)),
  })
  const created = await jsonResponse(createdResponse)
  if (!createdResponse.ok) throw new Error(`Vibi TTS HTTP ${createdResponse.status}: ${errorMessage(created.error)}`)
  if (!created.id) throw new Error('Vibi chưa trả mã tác vụ TTS')

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const deadline = Date.now() + timeoutMs
  let task = created
  while (task.status !== 'completed') {
    if (task.status === 'failed') throw new Error(`Vibi không tạo được giọng: ${errorMessage(task.error)}`)
    if (Date.now() >= deadline) throw new Error('Vibi tạo giọng quá thời gian chờ')
    if (task !== created || task.status === 'pending' || task.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }
    const statusResponse = await fetch(`${VIBI_API_BASE_URL}/v1/history/${encodeURIComponent(created.id)}`, {
      headers: {'xi-api-key': apiKey},
    })
    task = await jsonResponse(statusResponse)
    if (!statusResponse.ok) throw new Error(`Vibi status HTTP ${statusResponse.status}: ${errorMessage(task.error)}`)
  }

  const audioUrl = task.result?.audio_url
  if (!audioUrl) throw new Error('Vibi hoàn tất nhưng chưa trả đường dẫn audio')
  const resolvedAudioUrl = new URL(audioUrl, VIBI_API_BASE_URL).toString()
  const audioResponse = await fetch(resolvedAudioUrl, {headers: {'xi-api-key': apiKey}})
  if (!audioResponse.ok) throw new Error(`Không tải được audio Vibi: HTTP ${audioResponse.status}`)
  const audio = Buffer.from(await audioResponse.arrayBuffer())
  if (audio.length <= 500) throw new Error('Audio Vibi trả về không hợp lệ')
  return audio
}
