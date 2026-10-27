import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {getFfmpegBinaryPath} from '@/lib/video/ffmpeg'

const run = promisify(execFile)
export const VOICE_SAMPLE_RATE = 44100

/** Detect only outer silence; pauses inside a sentence must remain untouched. */
export function speechBounds(samples: Float32Array, sampleRate = VOICE_SAMPLE_RATE) {
  if (!samples.length) throw new Error('Giọng đọc không có dữ liệu âm thanh.')
  const window = Math.max(1, Math.round(sampleRate * 0.01))
  const levels: number[] = []
  for (let start = 0; start < samples.length; start += window) {
    let power = 0
    const end = Math.min(samples.length, start + window)
    for (let index = start; index < end; index++) power += samples[index] ** 2
    levels.push(Math.sqrt(power / (end - start)))
  }
  const peak = levels.reduce((max, value) => Math.max(max, value), 0)
  if (peak < 0.000001) throw new Error('Giọng đọc chỉ chứa khoảng lặng. Vui lòng tạo lại giọng.')
  const threshold = Math.min(10 ** (-65 / 20), peak * 0.05)
  const first = levels.findIndex(value => value >= threshold)
  const last = levels.findLastIndex(value => value >= threshold)
  const durationSec = samples.length / sampleRate
  const speechStartSec = first * window / sampleRate
  const speechEndSec = Math.min(samples.length, (last + 1) * window) / sampleRate
  return {durationSec, speechStartSec, speechEndSec, trimStartSec: Math.max(0, speechStartSec - 0.035), trimEndSec: Math.min(durationSec, speechEndSec + 0.06)}
}

export async function analyzeVoiceFile(file: string, ffmpeg = getFfmpegBinaryPath()) {
  const {stdout} = await run(ffmpeg, ['-v', 'error', '-i', file, '-f', 'f32le', '-ar', String(VOICE_SAMPLE_RATE), '-ac', '1', '-'], {encoding: 'buffer', maxBuffer: 32 * 1024 ** 2})
  const samples = new Float32Array(stdout.length / 4)
  for (let index = 0; index < samples.length; index++) samples[index] = stdout.readFloatLE(index * 4)
  return speechBounds(samples)
}

export async function analyzeVoiceBuffer(buffer: Buffer) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vipee-voice-audit-'))
  try {
    const file = path.join(directory, 'voice.mp3')
    await fs.writeFile(file, buffer)
    return await analyzeVoiceFile(file)
  } finally {await fs.rm(directory, {recursive: true, force: true})}
}

/** WAV segments contain exact PCM frame counts, with no per-segment MP3 delay. */
export function wavDuration(buffer: Buffer): number {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Phân đoạn âm thanh không phải WAV hợp lệ.')
  let bytesPerSecond = 0
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    if (id === 'fmt ' && size >= 16 && offset + 24 <= buffer.length) bytesPerSecond = buffer.readUInt32LE(offset + 16)
    if (id === 'data' && bytesPerSecond > 0 && offset + 8 + size <= buffer.length) return size / bytesPerSecond
    offset += 8 + size + size % 2
  }
  throw new Error('Không đo được thời lượng PCM của giọng đọc.')
}

/** Decode each Google response independently, then encode a single valid MP3. */
export async function joinVoiceChunks(buffers: Buffer[]): Promise<Buffer> {
  if (!buffers.length) throw new Error('Không có phân đoạn giọng đọc.')
  if (buffers.length === 1) return buffers[0]
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vipee-tts-join-'))
  try {
    const inputs: string[] = []
    for (const [index, buffer] of buffers.entries()) {
      const file = path.join(directory, `chunk-${index}.mp3`)
      await fs.writeFile(file, buffer)
      inputs.push('-i', file)
    }
    const output = path.join(directory, 'voice.mp3')
    const concat = buffers.map((_buffer, index) => `[${index}:a]`).join('') + `concat=n=${buffers.length}:v=0:a=1[voice]`
    await run(getFfmpegBinaryPath(), ['-y', '-v', 'error', ...inputs, '-filter_complex', concat, '-map', '[voice]', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', String(VOICE_SAMPLE_RATE), output], {maxBuffer: 1024 ** 2})
    return await fs.readFile(output)
  } finally {await fs.rm(directory, {recursive: true, force: true})}
}
