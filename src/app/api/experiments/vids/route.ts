import {NextRequest, NextResponse} from 'next/server'
import {readFile, unlink} from 'node:fs/promises'
import path from 'node:path'
import {reviewVidsFidelity} from '@/lib/ai/vids-fidelity-review'
import {cleanVidsFrame} from '@/lib/video/vids-clean-frame'
import {prepareVidsMotion} from '@/lib/ai/vids-motion-plan'
import {VIDS_MOTION_VERSION} from '@/lib/video/vids-physical-path'
import {clipFilePath, readVidsClip, saveVidsVideo, vidsCacheKey, VIDS_CACHE_DIR, VIDS_VIDEO_MAX, writeVidsClip} from '@/lib/video/vids-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const BRIDGE = 'http://127.0.0.1:4317'
const active = new Set<string>()
const localHost = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)
function requireLocal(request: NextRequest) {
  // Next's internal URL can use localhost even when the browser opened 127.0.0.1.
  // Validate the actual Host rather than trusting forwarded host headers.
  const actual = new URL(`${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`)
  if (!localHost(actual.hostname)) throw new Error('LOCAL_EXPERIMENT_ONLY')
  const origin = request.headers.get('origin')
  if (origin && origin !== actual.origin) throw new Error('INVALID_ORIGIN')
}
async function bridge(request: NextRequest, route: string, body?: unknown) {
  const token = request.headers.get('x-vids-pairing') || ''
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('LOCAL_PAIRING_REQUIRED')
  let response: Response
  try {
    response = await fetch(`${BRIDGE}${route}`, {method: body ? 'POST' : 'GET', headers: {Authorization: `Bearer ${token}`, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(12_000), cache: 'no-store'})
  } catch { throw new Error('LOCAL_BRIDGE_UNAVAILABLE') }
  return response
}
const responseRecord = (record: Awaited<ReturnType<typeof readVidsClip>>) => record ? {...record, ...(record.status === 'complete' ? {src: `/api/experiments/vids?key=${record.key}`} : {})} : null
function failure(error: unknown) {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{1,70}$/.test(error.message) ? error.message : 'EXPERIMENT_FAILED'
  return NextResponse.json({error: code}, {status: code === 'LOCAL_EXPERIMENT_ONLY' || code === 'INVALID_ORIGIN' ? 403 : 400})
}

export async function GET(request: NextRequest) {
  try {
    requireLocal(request)
    const key = request.nextUrl.searchParams.get('key') || ''
    const record = await readVidsClip(key)
    if (record?.status !== 'complete') return new NextResponse(null, {status: 404})
    const bytes = await readFile(clipFilePath(key))
    const headers = {'Content-Type': 'video/mp4', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes'}
    const range = request.headers.get('range')
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match || (!match[1] && !match[2])) return new NextResponse(null, {status: 416, headers: {'Content-Range': `bytes */${bytes.length}`}})
      const start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]))
      const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) return new NextResponse(null, {status: 416, headers: {'Content-Range': `bytes */${bytes.length}`}})
      return new NextResponse(bytes.subarray(start, end + 1), {status: 206, headers: {...headers, 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': String(end - start + 1)}})
    }
    return new NextResponse(bytes, {headers: {...headers, 'Content-Length': String(bytes.length)}})
  } catch (error) { return failure(error) }
}

export async function POST(request: NextRequest) {
  let lock: string | undefined
  try {
    const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data')
    if (multipart) {
      requireLocal(request)
      if (Number(request.headers.get('content-length')) > VIDS_VIDEO_MAX + 7 * 1024 * 1024) throw new Error('FILE_TOO_LARGE')
      const data = await request.formData()
      const key = vidsCacheKey(String(data.get('image') || ''), String(data.get('prompt') || ''))
      const file = data.get('clip')
      if (!(file instanceof File) || file.size > VIDS_VIDEO_MAX) throw new Error('INVALID_MP4')
      if (active.has(key)) throw new Error('CLIP_ALREADY_ACTIVE')
      const existing = await readVidsClip(key)
      if (existing?.status === 'complete') return NextResponse.json({clip: responseRecord(existing)})
      active.add(key); lock = key
      return NextResponse.json({clip: responseRecord(await saveVidsVideo(key, Buffer.from(await file.arrayBuffer())))})
    }
    if (Number(request.headers.get('content-length')) > 7 * 1024 * 1024) throw new Error('INPUT_TOO_LARGE')
    const value = await request.json()
    if (value.action === 'plan-motion') return NextResponse.json({motion: await prepareVidsMotion(value.image, value.productName)})
    if (value.action === 'review') return NextResponse.json({report: await reviewVidsFidelity(value.reference, value.frames, value.expected)})
    requireLocal(request)
    if (value.action === 'clean-frame') return NextResponse.json({clip: responseRecord(await cleanVidsFrame(value.key, value.bottomPercent))})
    if (value.action === 'status') {
      const response = await bridge(request, '/status')
      if (!response.ok) throw new Error('LOCAL_PAIRING_REJECTED')
      const status = await response.json()
      return NextResponse.json({worker: status.worker, remainingJobs: status.remainingJobs})
    }
    if (value.action === 'poll') {
      const record = await readVidsClip(value.key)
      if (!record || record.status !== 'pending') return NextResponse.json({clip: responseRecord(record)})
      if (!record.jobId) throw new Error('SUBMISSION_UNCERTAIN_CHECK_VIDS')
      const response = await bridge(request, '/status')
      if (!response.ok) throw new Error('LOCAL_PAIRING_REJECTED')
      const status = await response.json()
      const job = status.jobs.find((job: {id: string}) => job.id === record.jobId)
      if (!job) throw new Error('PREVIOUS_JOB_NOT_IN_BRIDGE')
      if (job.status === 'failed') {
        const failed = {...record, status: 'failed' as const, code: 'GENERATION_FAILED_CHECK_VIDS'}
        await writeVidsClip(failed)
        return NextResponse.json({clip: responseRecord(failed)})
      }
      if (job.status === 'complete') {
        if (active.has(record.key)) return NextResponse.json({clip: responseRecord(record)})
        active.add(record.key); lock = record.key
        const download = await bridge(request, `/clips/${record.jobId}.mp4`)
        if (!download.ok) throw new Error('CLIP_DOWNLOAD_FAILED')
        if (Number(download.headers.get('content-length')) > VIDS_VIDEO_MAX) throw new Error('FILE_TOO_LARGE')
        const saved = {...await saveVidsVideo(record.key, Buffer.from(await download.arrayBuffer())), origin: 'vids-create' as const}
        await writeVidsClip(saved)
        return NextResponse.json({clip: responseRecord(saved)})
      }
      return NextResponse.json({clip: responseRecord(record)})
    }
    if (!['prepare', 'generate'].includes(value.action)) throw new Error('INVALID_ACTION')
    const key = vidsCacheKey(value.image, value.prompt)
    if (active.has(key)) throw new Error('CLIP_ALREADY_ACTIVE')
    active.add(key); lock = key
    const existing = await readVidsClip(key)
    if (existing || value.action === 'prepare') return NextResponse.json({key, clip: responseRecord(existing)})
    if (value.confirmGeneration !== true) throw new Error('CONFIRM_GENERATION_REQUIRED')
    // Recompile canonical image evidence at the server boundary. A stale client
    // or a modified prompt must not bypass the physical-path gate or spend quota.
    if (value.motionVersion !== VIDS_MOTION_VERSION) throw new Error('MOTION_PLAN_OUTDATED')
    const motion = await prepareVidsMotion(value.image, value.productName)
    if (!motion.ready) throw new Error('PHYSICAL_PATH_UNVERIFIED')
    if (motion.prompt.trim() !== value.prompt.trim()) throw new Error('MOTION_PROMPT_CHANGED')
    const readiness = await bridge(request, '/status')
    if (!readiness.ok) throw new Error('LOCAL_PAIRING_REJECTED')
    const state = await readiness.json()
    if (!state.worker.connected || !state.worker.ready || !state.worker.compatible) throw new Error('WORKER_NOT_READY')
    if (state.worker.nativeProtocol !== 1 || !state.worker.nativeReady) throw new Error('NATIVE_EXTENSION_UPDATE_REQUIRED')
    if (state.remainingJobs < 1) throw new Error('LOCAL_JOB_LIMIT')
    // Persist before sending: an interrupted request must never cause a second generation.
    await writeVidsClip({key, status: 'pending'})
    const response = await bridge(request, '/jobs', {kind: 'generate', engine: 'create-ui', image: value.image, prompt: value.prompt, confirmGeneration: true})
    if (!response.ok) {
      await unlink(path.join(VIDS_CACHE_DIR, `${key}.json`))
      const error = await response.json()
      throw new Error(typeof error.error === 'string' ? error.error : 'LOCAL_SUBMISSION_FAILED')
    }
    const job = await response.json()
    if (typeof job.id !== 'string' || !/^[a-f0-9-]{36}$/.test(job.id)) throw new Error('SUBMISSION_UNCERTAIN_CHECK_VIDS')
    const record = {key, status: 'pending' as const, jobId: job.id}
    await writeVidsClip(record)
    return NextResponse.json({key, clip: responseRecord(record)})
  } catch (error) { return failure(error) }
  finally { if (lock) active.delete(lock) }
}
