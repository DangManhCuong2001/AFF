import {createHash, randomUUID} from 'node:crypto'
import {readFile, unlink} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import path from 'node:path'
import {getFfmpegBinaryPath} from './ffmpeg'
import {clipFilePath, readVidsClip, saveVidsVideo, VIDS_CACHE_DIR, writeVidsClip, type StoredVidsClip} from './vids-store'

const execute = promisify(execFile)
const inFlight = new Map<string, Promise<StoredVidsClip>>()
/** A reviewed presentation crop; the full original stays available for comparison. */
export async function cleanVidsFrame(sourceKey: string, bottomPercent: number) {
  if (![8, 12, 16].includes(bottomPercent)) throw new Error('INVALID_FRAME_CROP')
  let source = await readVidsClip(sourceKey)
  if (source?.originalKey) source = await readVidsClip(source.originalKey)
  if (source?.status !== 'complete') throw new Error('SOURCE_CLIP_REQUIRED')
  const originalKey = source.key
  const key = createHash('sha256').update(`reviewed-bottom-crop-v1:${originalKey}:${bottomPercent}`).digest('hex')
  const cached = await readVidsClip(key)
  if (cached?.status === 'complete') return cached
  if (inFlight.has(key)) return inFlight.get(key)!
  const operation = (async () => {
    const temporary = path.join(VIDS_CACHE_DIR, `${key}.${randomUUID()}.mp4`)
    try {
      await execute(getFfmpegBinaryPath(), ['-v', 'error', '-i', clipFilePath(originalKey), '-vf', `crop=iw:trunc(ih*${1 - bottomPercent / 100}/2)*2:0:0`, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', temporary], {timeout: 40_000, maxBuffer: 128 * 1024})
      const record = {...await saveVidsVideo(key, await readFile(temporary)), originalKey, trimBottomPercent: bottomPercent}
      await writeVidsClip(record)
      return record
    } finally {await unlink(temporary).catch(() => {})}
  })()
  inFlight.set(key, operation)
  try {return await operation} finally {inFlight.delete(key)}
}
