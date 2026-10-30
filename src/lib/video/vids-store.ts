import {createHash, randomUUID} from 'node:crypto'
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {getFfmpegBinaryPath} from './ffmpeg'

export const VIDS_CACHE_DIR = path.join(process.cwd(), '.data', 'vids-experiment')
export const VIDS_VIDEO_MAX = 32 * 1024 * 1024
export interface StoredVidsClip {
  key: string
  status: 'pending' | 'complete' | 'failed'
  jobId?: string
  durationSec?: number
  code?: string
  originalKey?: string
  trimBottomPercent?: number
  origin?: 'vids-create'
}
export const validVidsKey = (key: string) => /^[a-f0-9]{64}$/.test(key)
export function vidsCacheKey(image: string, prompt: string): string {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000 || typeof image !== 'string' || image.length > 7 * 1024 * 1024) throw new Error('INVALID_INPUT')
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
  if (!match) throw new Error('INVALID_IMAGE')
  const bytes = Buffer.from(match[2], 'base64')
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!valid || bytes.length < 16 || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) throw new Error('INVALID_IMAGE')
  return createHash('sha256').update('vids-experiment-376-v1\0').update(bytes).update('\0').update(prompt.trim()).digest('hex')
}
export async function readVidsClip(key: string): Promise<StoredVidsClip | null> {
  if (!validVidsKey(key)) throw new Error('INVALID_CACHE_KEY')
  try {
    const record = JSON.parse(await readFile(path.join(VIDS_CACHE_DIR, `${key}.json`), 'utf8')) as StoredVidsClip
    if (record.key !== key || !['pending', 'complete', 'failed'].includes(record.status)) throw new Error('INVALID_CACHE_RECORD')
    return record
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
export async function writeVidsClip(record: StoredVidsClip) {
  if (!validVidsKey(record.key)) throw new Error('INVALID_CACHE_KEY')
  await mkdir(VIDS_CACHE_DIR, {recursive: true})
  const temporary = path.join(VIDS_CACHE_DIR, `${record.key}.${randomUUID()}.part`)
  await writeFile(temporary, JSON.stringify(record), {mode: 0o600})
  await rename(temporary, path.join(VIDS_CACHE_DIR, `${record.key}.json`))
}
export function clipFilePath(key: string) {
  if (!validVidsKey(key)) throw new Error('INVALID_CACHE_KEY')
  return path.join(VIDS_CACHE_DIR, `${key}.mp4`)
}
export async function saveVidsVideo(key: string, bytes: Buffer): Promise<StoredVidsClip> {
  if (!validVidsKey(key)) throw new Error('INVALID_CACHE_KEY')
  if (bytes.length < 24 || bytes.length > VIDS_VIDEO_MAX || bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error('INVALID_MP4')
  await mkdir(VIDS_CACHE_DIR, {recursive: true})
  const temporary = path.join(VIDS_CACHE_DIR, `${key}.${randomUUID()}.mp4`)
  const {unlink} = await import('node:fs/promises')
  try {
    await writeFile(temporary, bytes, {mode: 0o600})
    const metadata = await new Promise<string>(resolve => {
      execFile(getFfmpegBinaryPath(), ['-hide_banner', '-i', temporary], {timeout: 15_000, maxBuffer: 128 * 1024}, (_error, _stdout, stderr) => resolve(stderr))
    })
    const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(metadata)
    const durationSec = duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : 0
    if (!/Video:/.test(metadata) || durationSec <= 0 || durationSec > 15) throw new Error('INVALID_CLIP_DURATION')
    await rename(temporary, clipFilePath(key))
    const record: StoredVidsClip = {key, status: 'complete', durationSec}
    await writeVidsClip(record)
    return record
  } finally { await unlink(temporary).catch(() => {}) }
}
