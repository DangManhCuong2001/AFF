'use client'

import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react'
import Image from 'next/image'
import type {ProductInput} from '@/engines/core/types'
import {loadProductImageBlob} from '@/lib/ai/prepare-images'
import type {SceneVideoClips, VideoVisualMode, VidsShot} from '@/lib/video/vids-plan'
import {vidsBatchGate, vidsReferenceSignature} from '@/lib/video/vids-plan'
import {waitForVidsWorker} from '@/lib/video/vids-worker'
import {cropVidsReference, frameVidsReferencePortrait, vidsReferenceFrameAspect, type ReferenceCrop} from '@/lib/video/vids-reference'
import {VidsReferenceEditor} from './VidsReferenceEditor'
import {VidsClipReview} from './VidsClipReview'
import {hasPurposefulVidsAction} from '@/lib/video/vids-interaction'
import {VIDS_MOTION_VERSION, type VidsPhysicalPath} from '@/lib/video/vids-physical-path'
import {canApproveVidsClip, type VidsFidelityReport} from '@/lib/video/vids-fidelity'

interface Clip {key: string; status: 'pending' | 'complete' | 'failed'; src?: string; durationSec?: number; code?: string; originalKey?: string; trimBottomPercent?: number; origin?: 'vids-create'}
interface Motion {version: number; ready: boolean; prompt: string; path: VidsPhysicalPath; action: {id: string; label: string; reason?: string}}
interface Item {image?: string; originalImage?: string; originalBlob?: Blob; motion?: Motion; planSignature?: string; referenceReviewed?: boolean; referenceKind?: 'framed' | 'crop' | 'upload'; referenceFrameAspect?: number; frameAspect?: number; clip?: Clip; fullClip?: Clip; reviewed?: boolean; fidelity?: {src: string; reference: string; report: VidsFidelityReport}; error?: string}
const currentFidelity = (item?: Item) => item?.fidelity?.src === (item?.fullClip?.src || item?.clip?.src) && item?.fidelity?.reference === item?.image ? item?.fidelity?.report : undefined
const verifiedMotion = (motion?: Motion) => motion?.version === VIDS_MOTION_VERSION && motion.ready && hasPurposefulVidsAction(motion.action.id)
interface Props {
  mode: VideoVisualMode
  onModeChange: (mode: VideoVisualMode) => void
  clipLimit: 1 | 3
  onClipLimitChange: (limit: 1 | 3) => void
  product: ProductInput
  shots: VidsShot[]
  signature: string
  onClipsChange: (value: {signature: string; clips: SceneVideoClips}) => void
  disabled?: boolean
}
const messages: Record<string, string> = {
  LOCAL_EXPERIMENT_ONLY: 'Bản Vids thử nghiệm hiện chạy trên localhost. Luồng Từ ảnh vẫn dùng bình thường.',
  LOCAL_BRIDGE_UNAVAILABLE: 'Chạy pnpm vids:bridge rồi kết nối extension trước khi tạo clip.',
  LOCAL_PAIRING_REQUIRED: 'Nhập mã local 64 ký tự từ trang http://127.0.0.1:4317.',
  LOCAL_PAIRING_REJECTED: 'Mã local đã đổi. Sao chép mã mới từ trang bridge và kết nối lại extension.',
  WORKER_NOT_READY: 'Extension chưa sẵn sàng. Làm mới phiên Vids và mở bảng tạo video trong Vids.',
  NATIVE_EXTENSION_UPDATE_REQUIRED: 'Tải lại extension AFF Google Vids bản 0.3.0 và kết nối lại để tự tạo bằng Create, khung dọc 8 giây.',
  LOCAL_JOB_LIMIT: 'Đã hết số tác vụ trong lần chạy bridge này. Clip đã lưu vẫn dùng được.',
  JOB_ALREADY_ACTIVE: 'Đang có một tác vụ khác trong bridge. Chờ tác vụ đó hoàn tất.',
  PREVIOUS_JOB_NOT_IN_BRIDGE: 'Tác vụ thuộc lần chạy bridge trước. Kiểm tra lịch sử Vids; có thể tải MP4 vào cảnh để dùng lại.',
  SUBMISSION_UNCERTAIN_CHECK_VIDS: 'Có thể Google đã nhận tác vụ. Kiểm tra Vids, không tạo lại tự động; có thể tải MP4 đã có vào cảnh.',
  GENERATION_FAILED_CHECK_VIDS: 'Tác vụ trước đã lỗi. Kiểm tra Vids; app không tự tạo lại. Có thể tải MP4 vào cảnh để phục hồi.',
  INVALID_IMAGE: 'Ảnh cần là PNG, JPEG hoặc WebP hợp lệ, tối đa 5 MB.',
  MOTION_PLAN_OUTDATED: 'Kế hoạch thao tác đã cũ. Tải lại trang để chuẩn bị đường thao tác hiện tại; chưa tạo clip mới.',
  PHYSICAL_PATH_UNVERIFIED: 'Chưa xác định được lối thao tác đủ rõ từ ảnh; chưa dùng hạn mức Vids.',
  MOTION_PROMPT_CHANGED: 'Prompt không khớp kế hoạch từ ảnh hiện tại. Chuẩn bị lại ảnh và thao tác trước khi tạo clip.',
  INVALID_MOTION_PLAN: 'Gemini chưa trả được kế hoạch thao tác hợp lệ. Chưa dùng hạn mức Vids; hãy phân tích lại hoặc chọn ảnh khác.',
  MOTION_PLAN_QUOTA: 'Gemini đang hết hạn mức lập chuyển động. Chưa dùng hạn mức Vids; hãy thử lại sau.',
  GEMINI_NOT_CONFIGURED: 'Production chưa cấu hình GEMINI_API_KEY để lập chuyển động.',
}
const explain = (code: string) => messages[code] || `Chưa hoàn tất: ${code}. Clip đã có được giữ lại.`
const subscribe = () => () => {}
const localSnapshot = () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const LOCAL_BRIDGE = 'http://127.0.0.1:4317'
const mediaDuration = (src: string) => new Promise<number>((resolve, reject) => {
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.onloadedmetadata = () => resolve(video.duration)
  video.onerror = () => reject(new Error('Không đọc được thời lượng clip Google Vids.'))
  video.src = src
})
async function localBridgeRequest(value: Record<string, unknown>, token: string) {
  const headers = {Authorization: `Bearer ${token}`}
  if (value.action === 'prepare') return {clip: null}
  if (value.action === 'status' || value.action === 'poll') {
    const response = await fetch(`${LOCAL_BRIDGE}/status`, {headers, cache: 'no-store'})
    const state = await response.json()
    if (!response.ok) throw new Error(explain(state.error || 'LOCAL_BRIDGE_UNAVAILABLE'))
    if (value.action === 'status') return state
    const job = Array.isArray(state.jobs) ? state.jobs.find((entry: {id?: string}) => entry.id === value.key) : undefined
    if (!job) throw new Error(explain('PREVIOUS_JOB_NOT_IN_BRIDGE'))
    if (job.status !== 'complete') return {clip: {key: job.id, status: job.status, code: job.code}}
    const download = await fetch(`${LOCAL_BRIDGE}/clips/${job.id}.mp4`, {headers, cache: 'no-store'})
    if (!download.ok) throw new Error(explain('CLIP_DOWNLOAD_FAILED'))
    const src = URL.createObjectURL(await download.blob())
    return {clip: {key: job.id, status: 'complete', src, durationSec: await mediaDuration(src)}}
  }
  if (value.action === 'generate') {
    const response = await fetch(`${LOCAL_BRIDGE}/jobs`, {
      method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({kind: 'generate', engine: 'create-ui', image: value.image, prompt: value.prompt, confirmGeneration: true}),
    })
    const job = await response.json()
    if (!response.ok) throw new Error(explain(job.error || 'LOCAL_SUBMISSION_FAILED'))
    return {clip: {key: job.id, status: job.status, code: job.code}}
  }
  throw new Error(explain('INVALID_ACTION'))
}
async function request(value: Record<string, unknown>, token: string, productionBridge = false) {
  if (productionBridge && !['plan-motion', 'review'].includes(String(value.action))) return localBridgeRequest(value, token)
  const response = await fetch('/api/experiments/vids', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Vids-Pairing': token}, body: JSON.stringify(value)})
  const result = await response.json()
  if (!response.ok) throw new Error(explain(result.error || 'EXPERIMENT_FAILED'))
  return result
}
const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Không đọc được ảnh sản phẩm.'))
  reader.readAsDataURL(blob)
})

export function VidsExperimentPanel({mode, onModeChange, clipLimit, onClipLimitChange, product, shots, signature, onClipsChange, disabled}: Props) {
  const [token, setToken] = useState('')
  const [items, setItems] = useState<Record<string, Item>>({})
  const [itemsSignature, setItemsSignature] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const [remainingLocalJobs, setRemainingLocalJobs] = useState<number>()
  const isLocal = useSyncExternalStore(subscribe, localSnapshot, () => false)
  const call = (value: Record<string, unknown>, pairing = '') => request(value, pairing, !isLocal)
  const mounted = useRef(true)
  const stop = useRef(false)
  const itemsRef = useRef(items)
  const signatureRef = useRef(signature)
  useEffect(() => {signatureRef.current = signature; itemsRef.current = items}, [signature, items])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stop.current = true }
  }, [])
  useEffect(() => {
    const clips: SceneVideoClips = {}
    for (const shot of itemsSignature === signature ? shots : []) {
      const item = items[shot.sceneId]
      if (item?.reviewed && canApproveVidsClip(currentFidelity(item)) && item.clip?.status === 'complete' && item.clip.src && item.clip.durationSec) clips[shot.sceneId] = {src: item.clip.src, durationSec: item.clip.durationSec, ...(item.frameAspect ? {frameAspect: item.frameAspect} : {})}
    }
    onClipsChange({signature, clips})
  }, [items, itemsSignature, signature, shots, onClipsChange])
  useEffect(() => {
    if (mode !== 'vids-experiment') return
    let current = true
    void Promise.resolve().then(async () => {
      if (!current) return
      setPreparing(true)
      setConfirm(false)
      const entries = await Promise.all(shots.map(async shot => {
      try {
        const asset = product.assets.find(asset => asset.id === shot.assetId)
        if (!asset) throw new Error('Không tìm thấy ảnh tham chiếu của cảnh.')
        const previous = itemsRef.current[shot.sceneId]
        const sourceSignature = vidsReferenceSignature(product, shot)
        const sameSource = previous?.planSignature === sourceSignature
        const reusableReference = !!(sameSource && previous.image && previous.referenceFrameAspect)
        const originalBlob = sameSource && previous.originalBlob || await loadProductImageBlob(asset)
        const originalImage = sameSource && previous.originalImage || await dataUrl(originalBlob)
        const referenceBlob = reusableReference ? undefined : await frameVidsReferencePortrait(originalBlob)
        const image = reusableReference ? previous.image! : await dataUrl(referenceBlob!)
        const referenceFrameAspect = reusableReference ? previous.referenceFrameAspect! : await vidsReferenceFrameAspect(referenceBlob!)
        let motion: Motion | undefined = sameSource && previous.motion?.version === VIDS_MOTION_VERSION ? previous.motion : undefined
        let motionError: string | undefined
        try {motion ||= (await call({action: 'plan-motion', image, productName: product.name})).motion}
        catch (error) {motionError = error instanceof Error ? error.message : 'Chưa lập được thao tác bằng Gemini. Chưa dùng hạn mức Vids; bạn vẫn có thể nhập MP4 đã có hoặc phân tích lại.'}
        const result = await call({action: 'prepare', image, prompt: motion?.prompt || shot.prompt})
        const fullClip: Clip | undefined = result.clip?.status === 'complete' && result.clip.origin === 'vids-create' ? result.clip : undefined
        const clip: Clip | undefined = fullClip ? (await call({action: 'clean-frame', key: fullClip.key, bottomPercent: 12})).clip : result.clip || undefined
        return [shot.sceneId, {image, originalBlob, originalImage, motion, error: motionError, planSignature: sourceSignature, referenceKind: reusableReference ? previous.referenceKind : 'framed', referenceFrameAspect, frameAspect: reusableReference ? previous.frameAspect : undefined, referenceReviewed: reusableReference && !!previous.referenceReviewed, clip, fullClip, fidelity: reusableReference ? previous.fidelity : undefined, reviewed: reusableReference && previous?.clip?.key === clip?.key && !!previous?.reviewed}] as const
      } catch (error) { return [shot.sceneId, {error: error instanceof Error ? error.message : 'Chưa đọc được ảnh.'}] as const }
      }))
      if (current) {setItems(Object.fromEntries(entries)); setItemsSignature(signature); setPreparing(false)}
    })
    return () => { current = false }
    // Signature includes the reference assets and motion prompts, excluding sales copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, isLocal])

  const update = (id: string, item: Partial<Item>) => { if (mounted.current && signatureRef.current === signature) setItems(previous => ({...previous, [id]: {...previous[id], ...item}})) }
  const receiveReport = (id: string, src: string, reference: string, report: VidsFidelityReport) => {
    const item = itemsRef.current[id]
    if ((item?.fullClip?.src || item?.clip?.src) !== src || item?.image !== reference) return
    update(id, {fidelity: {src, reference, report}, ...(!canApproveVidsClip(report) ? {reviewed: false} : {})})
  }
  const applyReference = async (shot: VidsShot, crop?: ReferenceCrop, file?: File) => {
    const item = itemsRef.current[shot.sceneId]
    if (busy || preparing || disabled || !item?.originalBlob || item.clip?.status === 'pending') return
    setBusy(true); setConfirm(false)
    try {
      if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) throw new Error(messages.INVALID_IMAGE)
      const selectedBlob = file || (crop ? await cropVidsReference(item.originalBlob, crop) : item.originalBlob)
      const referenceBlob = await frameVidsReferencePortrait(selectedBlob)
      const image = await dataUrl(referenceBlob)
      const referenceFrameAspect = await vidsReferenceFrameAspect(referenceBlob)
      const motion: Motion = (await call({action: 'plan-motion', image, productName: product.name})).motion
      const result = await call({action: 'prepare', image, prompt: motion.prompt})
      update(shot.sceneId, {image, motion, referenceKind: file ? 'upload' : crop ? 'crop' : 'framed', referenceFrameAspect, frameAspect: undefined, referenceReviewed: false, clip: result.clip || undefined, fullClip: undefined, reviewed: false, error: undefined})
      setNotice('Đã chuẩn bị ảnh tham chiếu mới, chưa gọi Google. Kiểm tra ảnh còn đủ sản phẩm và không còn banner thừa trước khi tạo clip.')
    } catch (error) {setNotice(error instanceof Error ? error.message : 'Chưa chuẩn bị được ảnh.')}
    finally {if (mounted.current) setBusy(false)}
  }
  const checkConnection = async () => {
    if (checkingConnection) return
    setCheckingConnection(true)
    try {
      const state = await call({action: 'status'}, token.trim())
      setRemainingLocalJobs(state.remainingJobs)
      setNotice(state.remainingJobs === 0
        ? 'Bridge đang giới hạn 0 tác vụ mới. Vẫn chuẩn bị ảnh, xem hoặc nhập MP4 đã có được. Đây là giới hạn local, không phải số dư hạn mức Google.'
        : !state.worker.connected
          ? 'Bridge đang chạy nhưng extension chưa kết nối với mã local hiện tại. Mở extension AFF Google Vids 0.3.0, dán lại mã từ bridge và giữ tab Google Vids mở.'
          : state.worker.ready
            ? `Đã kết nối. Còn ${state.remainingJobs} tác vụ trong lần chạy bridge này; không phải số dư hạn mức Google.`
            : 'Extension đã kết nối nhưng phiên tạo clip chưa sẵn sàng. Trong cửa sổ extension, bấm Làm mới phiên Vids rồi mở bảng Create video trong tab Google Vids.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Chưa kết nối được bridge.') }
    finally {if (mounted.current) setCheckingConnection(false)}
  }
  const cleanFrame = async (shot: VidsShot) => {
    const item = itemsRef.current[shot.sceneId]
    if (busy || disabled || item?.clip?.status !== 'complete') return
    setBusy(true)
    try {
      if (item.fullClip) update(shot.sceneId, {clip: item.fullClip, fullClip: undefined, reviewed: false, frameAspect: undefined})
      else {
        const result = await call({action: 'clean-frame', key: item.clip.key, bottomPercent: 12})
        update(shot.sceneId, {clip: result.clip, fullClip: item.clip, reviewed: false, frameAspect: undefined})
      }
      setNotice('Đã đổi khung clip, không tạo lại bằng Google. Xem hết clip để chắc mép cắt không mất sản phẩm hoặc thao tác. Bản gốc vẫn được giữ; khai báo AI vẫn áp dụng khi đăng.')
    } catch (error) {setNotice(error instanceof Error ? error.message : 'Chưa đổi được khung clip.')}
    finally {if (mounted.current) setBusy(false)}
  }
  const generate = async () => {
    if (busy || preparing || !confirm) return
    const gate = vidsBatchGate(shots.flatMap(shot => {
      const item = itemsRef.current[shot.sceneId]
      return item?.clip ? [{status: item.clip.status, reviewed: item.reviewed}] : []
    }))
    if (gate === 'review') {setNotice('Đối chiếu clip đầu với ảnh gốc trước. Nếu sai sản phẩm, giữ ô duyệt tắt và dùng luồng Từ ảnh; app chưa tạo các cảnh còn lại.'); return}
    setBusy(true); stop.current = false; setConfirm(false)
    try {
      for (const shot of shots) {
        if (!mounted.current || signatureRef.current !== signature || stop.current) break
        const item = itemsRef.current[shot.sceneId]
        if (item?.clip?.status === 'complete') continue
        if (!item?.image || item.error) throw new Error(item?.error || 'Ảnh tham chiếu chưa sẵn sàng.')
        if (item.clip?.status === 'failed') throw new Error(explain(item.clip.code || 'GENERATION_FAILED_CHECK_VIDS'))
        if (!item.clip && !item.referenceReviewed) throw new Error('Kiểm tra và xác nhận ảnh tham chiếu của cảnh này trước khi dùng hạn mức Google.')
        if (!item.clip && !verifiedMotion(item.motion)) throw new Error('Chưa xác định được đường thao tác không vướng vật cản; chưa dùng hạn mức Vids. Chọn ảnh rõ lối mở, mặt đỡ hoặc điểm cầm hơn, hoặc dùng MP4 đã có.')
        setNotice(`Đang xử lý cảnh: ${shot.title}. Giữ tab Vids và extension mở.`)
        if (!item.clip) {
          try {await waitForVidsWorker(() => call({action: 'status'}, token.trim()))}
          catch (error) {throw new Error(explain(error instanceof Error ? error.message : 'WORKER_NOT_READY'))}
          if (!mounted.current || signatureRef.current !== signature || stop.current) break
        }
        let clip: Clip = item.clip || (await call({action: 'generate', image: item.image, prompt: item.motion?.prompt || shot.prompt, productName: product.name, motionVersion: item.motion?.version, confirmGeneration: true}, token.trim())).clip
        update(shot.sceneId, {clip})
        let polls = 0
        while (clip.status === 'pending') {
          if (!mounted.current || signatureRef.current !== signature) return
          if (++polls > 450) throw new Error('Đã ngừng chờ. Tác vụ có thể vẫn chạy; clip sẽ được kiểm tra tiếp khi bạn bấm tiếp tục, không gửi lại Generate.')
          await new Promise(resolve => setTimeout(resolve, 2000))
          clip = (await call({action: 'poll', key: clip.key}, token.trim())).clip
          if (!clip) throw new Error('Không tìm thấy tác vụ. Kiểm tra Vids trước khi tạo lại.')
          update(shot.sceneId, {clip})
        }
        if (clip.status !== 'complete') throw new Error(explain(clip.code || 'GENERATION_FAILED_CHECK_VIDS'))
        if ((clip.durationSec || 0) > (shot.expectedDurationSec || 8) + 0.5) throw new Error('Clip dài hơn dự kiến. Đã lưu và dừng tạo thêm để bạn kiểm tra clip có lẫn đoạn cũ hoặc khoảng trống không.')
        if (clip.origin === 'vids-create' && !clip.originalKey) {
          const fullClip = clip
          clip = (await call({action: 'clean-frame', key: clip.key, bottomPercent: 12})).clip
          update(shot.sceneId, {clip, fullClip, reviewed: false})
        }
        if (gate === 'sample') {
          setNotice('Đã tạo một clip kiểm tra. Xem toàn bộ đường đi của tay và vật: không xuyên khay/thành, có tiếp xúc rồi mới buông tay. Chỉ duyệt khi cả sản phẩm và thao tác đều đúng.')
          return
        }
      }
      setNotice('Clip đã có được lưu lại. Xem từng clip và đánh dấu đúng sản phẩm để dùng trong preview/MP4.')
    } catch (error) { if (mounted.current) setNotice(error instanceof Error ? error.message : 'Chưa hoàn tất thử nghiệm.') }
    finally { if (mounted.current) setBusy(false) }
  }
  const importClip = async (shot: VidsShot, file?: File) => {
    if (!file || busy || !items[shot.sceneId]?.image) return
    setBusy(true)
    try {
      if (!isLocal) {
        if (file.type !== 'video/mp4' || file.size > 32 * 1024 * 1024) throw new Error('MP4 phải nhỏ hơn 32 MB.')
        const src = URL.createObjectURL(file)
        update(shot.sceneId, {clip: {key: crypto.randomUUID(), status: 'complete', src, durationSec: await mediaDuration(src)}, fullClip: undefined, fidelity: undefined, reviewed: false, error: undefined})
        setNotice('Đã nạp MP4 từ máy vào phiên production. Xem và duyệt clip trước khi ghép.')
        return
      }
      const data = new FormData()
      data.append('image', items[shot.sceneId].image!)
      data.append('prompt', items[shot.sceneId].motion?.prompt || shot.prompt)
      data.append('clip', file)
      const response = await fetch('/api/experiments/vids', {method: 'POST', body: data})
      const result = await response.json()
      if (!response.ok) throw new Error(explain(result.error || 'IMPORT_FAILED'))
      update(shot.sceneId, {clip: result.clip, fullClip: undefined, fidelity: undefined, reviewed: false, error: undefined})
      setNotice('Đã lưu MP4 có sẵn. Xem và đánh dấu đúng sản phẩm để dùng; không gọi Google Vids.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không đọc được MP4.') }
    finally { if (mounted.current) setBusy(false) }
  }
  const missing = shots.filter(shot => items[shot.sceneId]?.clip?.status !== 'complete').length
  const nextItem = shots.map(shot => items[shot.sceneId]).find(item => item?.clip?.status !== 'complete')
  const needsReferenceReview = !!nextItem?.image && !nextItem.clip && !nextItem.referenceReviewed
  const blockedByPlanningError = !!nextItem?.image && !nextItem.clip && !!nextItem.error
  const blockedByMotion = !!nextItem?.image && !nextItem.clip && !nextItem.error && !verifiedMotion(nextItem.motion)
  const blockedByLocalLimit = remainingLocalJobs === 0 && !shots.some(shot => items[shot.sceneId]?.clip?.status === 'pending')
  const gate = vidsBatchGate(shots.flatMap(shot => items[shot.sceneId]?.clip ? [{status: items[shot.sceneId].clip!.status, reviewed: items[shot.sceneId].reviewed}] : []))
  return <section className="rounded-2xl border border-neutral-700 bg-neutral-950/50 p-4 space-y-4">
    <fieldset disabled={disabled} className="flex flex-wrap gap-3 text-sm">
      <legend className="font-semibold text-white mb-3">Nguồn hình cho video</legend>
      {([['images', 'Từ ảnh — đang dùng'], ['vids-experiment', 'Google Vids — thử nghiệm']] as const).map(([value, label]) => <label key={value} className={`flex items-center gap-2 rounded-xl border px-4 py-3 cursor-pointer ${mode === value ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200' : 'border-neutral-700 text-neutral-300'}`}><input type="radio" name="video-visual-mode" value={value} checked={mode === value} onChange={() => {if (value === 'images') stop.current = true; onModeChange(value)}} />{label}</label>)}
    </fieldset>
    {busy && <button type="button" onClick={() => {stop.current = true; setNotice('Sẽ dừng sau tác vụ hiện tại; không tạo các clip tiếp theo.')}} className="rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-200">Ngừng sau clip hiện tại</button>}
    {mode === 'vids-experiment' && <>
      <label className="block text-xs text-neutral-300">Giới hạn clip AI cho video này<select aria-label="Giới hạn clip AI" value={clipLimit} disabled={busy || preparing || disabled} onChange={event => {setConfirm(false); onClipLimitChange(event.target.value === '3' ? 3 : 1)}} className="mt-2 block w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5"><option value="1">Tiết kiệm — 1 clip mở đầu, tối đa 8 giây</option><option value="3">Mở rộng — tối đa 3 clip từ các ảnh khác nhau</option></select></label>
      <p className="text-xs leading-relaxed text-neutral-400">Extension tự mở Create, chọn Portrait 8 giây, đưa ảnh và prompt vào rồi tải MP4 về. Clip đầu chạy liên tục tối đa 8 giây, qua các câu lời đọc rồi chuyển sang ảnh chi tiết và CTA. Không lặp hoặc làm chậm clip để lấp thời lượng; chỉ clip bạn duyệt mới được dùng.</p>
      <p className="text-xs leading-relaxed text-amber-200">Thử một clip trước để kiểm tra độ giống sản phẩm. Vids có thể làm thay đổi hình dáng dù đã nhận ảnh tham chiếu; chỉ tạo tiếp sau khi bạn duyệt clip đúng sản phẩm.</p>
      {!isLocal && <p className="text-sm text-emerald-200">Production đang dùng worker trên máy này. Hãy chạy <code>pnpm video:local</code>, mở bridge và giữ extension cùng tab Google Vids hoạt động.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-0 text-xs text-neutral-300">Mã kết nối local<input type="password" autoComplete="off" value={token} onChange={event => {setToken(event.target.value); setRemainingLocalJobs(undefined); setConfirm(false)}} placeholder="Mã từ http://127.0.0.1:4317" className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5" /></label>
          <button type="button" onClick={checkConnection} disabled={checkingConnection} aria-busy={checkingConnection} className="rounded-lg border border-neutral-700 px-3 py-2.5 text-xs text-white disabled:opacity-40">{checkingConnection ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
          <a href="http://127.0.0.1:4317" target="_blank" rel="noreferrer" className="text-xs text-emerald-300 py-2.5">Mở bridge</a>
        </div>
        {preparing && <p className="text-xs text-neutral-400">Đang kiểm tra ảnh và tìm clip đã lưu. Chưa tạo clip Google.</p>}
        {!shots.length && <p className="text-xs text-amber-200">Chưa có cảnh phù hợp. Hoàn tất phân tích sản phẩm và chọn ảnh trước.</p>}
        <div className={`grid gap-4 ${shots.length > 1 ? 'md:grid-cols-2' : ''} ${shots.length > 2 ? 'xl:grid-cols-3' : ''}`}>{shots.map((shot, index) => {
          const item = items[shot.sceneId]
          const clip = item?.clip
          return <div key={`${signature}:${shot.sceneId}`} className="rounded-xl border border-neutral-800 p-3 space-y-3 min-w-0">
            <h4 className="text-sm text-white font-semibold">{index + 1}. {shot.title}</h4>
            {(item?.motion?.action.label || shot.actionLabel) && <p className="text-xs text-neutral-400">{index === 0 ? 'Mở đầu' : 'Cảnh bổ sung'}: {item?.motion?.action.label || shot.actionLabel}</p>}
            {(item?.motion?.action.reason || shot.actionNote) && <p className="text-xs text-amber-200">{item?.motion?.action.reason || shot.actionNote}</p>}
            {item?.image && <div className={`grid gap-2 ${clip?.src ? 'grid-cols-2' : ''}`}>
              <div><p className="mb-1 text-[11px] text-neutral-400">Ảnh gửi sang Vids{item.referenceKind === 'crop' ? ' · đã cắt và đóng khung dọc' : item.referenceKind === 'upload' ? ' · ảnh thay thế đã đóng khung dọc' : item.referenceKind === 'framed' ? ' · đủ ảnh, không kéo giãn' : ' · ảnh gốc'}</p><Image src={item.image} alt="Ảnh tham chiếu thực tế của cảnh" unoptimized width={480} height={640} className="w-full h-48 object-contain rounded-lg bg-neutral-900" /></div>
              {clip?.src && <div><p className="mb-1 text-[11px] text-neutral-400">Clip trả về</p><video src={clip.src} muted controls playsInline preload="metadata" className="w-full rounded-lg bg-black" style={{aspectRatio: item.frameAspect || 9 / 16, objectFit: item.frameAspect ? 'cover' : 'contain'}} /></div>}
            </div>}
            {clip?.src && <>
              {clip.trimBottomPercent && <p className="text-[11px] text-neutral-400">Đã cắt {clip.trimBottomPercent}% mép dưới để bỏ dấu nhìn thấy. Bản gốc được giữ; xem hết clip để kiểm tra sản phẩm và bàn tay còn đầy đủ.</p>}
              {isLocal && <button type="button" disabled={busy || preparing || disabled} onClick={() => void cleanFrame(shot)} className="rounded border border-neutral-700 px-3 py-2 text-xs text-neutral-200 disabled:opacity-40">{item?.fullClip ? 'Khôi phục khung gốc' : 'Cắt mép dưới để bỏ dấu Gemini'}</button>}
              {item?.referenceFrameAspect && <label className="flex items-start gap-2 text-xs text-neutral-300"><input type="checkbox" checked={!!item.frameAspect} disabled={busy || preparing || disabled} onChange={event => update(shot.sceneId, {frameAspect: event.target.checked ? item.referenceFrameAspect : undefined, reviewed: false})} />Khung gọn theo ảnh tham chiếu. Xem hết clip để chắc không cắt sản phẩm hoặc bàn tay; đổi khung cần duyệt lại.</label>}
              <VidsClipReview src={clip.src} frameAspect={item?.frameAspect} reference={item?.image} analysisSrc={item?.fullClip?.src} expected={item?.motion ? {actionId: item.motion.action.id, path: item.motion.path} : undefined} onReport={(src, reference, report) => receiveReport(shot.sceneId, src, reference, report)} />
            </>}
            {item?.originalImage && <VidsReferenceEditor original={item.originalImage} suggested={shot.referenceCrop} disabled={!!(busy || preparing || disabled || clip?.status === 'pending')} onApply={(crop, file) => {void applyReference(shot, crop, file)}} />}
            {shot.identityNotes?.length ? <p className="text-[11px] leading-relaxed text-neutral-400">Chi tiết cần giữ từ ảnh: {shot.identityNotes.join(' · ')}</p> : null}
            {!clip && item?.image && <label className="flex items-start gap-2 text-xs text-neutral-300"><input type="checkbox" disabled={busy || preparing || disabled} checked={!!item.referenceReviewed} onChange={event => update(shot.sceneId, {referenceReviewed: event.target.checked})} />Ảnh gửi đã giữ đủ sản phẩm, phụ kiện và bỏ banner thừa nếu có</label>}
            <p className="text-xs text-neutral-400">{item?.error || (clip?.status === 'complete' ? `Đã lưu ${clip.durationSec?.toFixed(2)}s — dùng lại không tốn lượt` : clip?.status === 'pending' ? 'Tác vụ đang chờ — bấm tiếp tục để kiểm tra, không tạo lại' : clip?.status === 'failed' ? explain(clip.code || 'GENERATION_FAILED_CHECK_VIDS') : 'Chưa có clip đã lưu')}</p>
            {clip?.status === 'complete' && <label className="flex items-start gap-2 text-xs text-emerald-200"><input type="checkbox" disabled={disabled || !canApproveVidsClip(currentFidelity(item))} checked={!!item?.reviewed && canApproveVidsClip(currentFidelity(item))} onChange={event => {if (canApproveVidsClip(currentFidelity(item))) update(shot.sceneId, {reviewed: event.target.checked})}} />Đã xem hết: đúng sản phẩm, đường đi và tiếp xúc hợp lý, không xuyên vật; dùng clip này</label>}
            {clip?.status === 'complete' && currentFidelity(item) && !canApproveVidsClip(currentFidelity(item)) && <p className="text-xs text-red-300">Clip có lỗi đã phát hiện, chưa được dùng để ghép. Chọn clip khác thay vì duyệt bỏ qua.</p>}
            {!clip?.src && <label className="block text-xs text-neutral-400">Hoặc dùng MP4 đã có (tối đa 32 MB)<input type="file" accept="video/mp4" disabled={busy || preparing || disabled || !item?.image} onChange={event => {void importClip(shot, event.target.files?.[0]); event.target.value = ''}} className="mt-2 w-full text-[11px]" /></label>}
            <details className="text-xs text-neutral-500"><summary>Chuyển động dự kiến</summary><p className="mt-2 leading-relaxed break-words">{item?.motion?.prompt || shot.prompt}</p></details>
          </div>
        })}</div>
        {missing > 0 && <div className="space-y-3">
          {gate === 'review' && <p className="text-xs text-amber-200">Chưa tạo các cảnh tiếp theo. Hãy đối chiếu ảnh gốc và duyệt clip đầu nếu sản phẩm chính xác.</p>}
          {needsReferenceReview && <p className="text-xs text-amber-200">Xác nhận ảnh gửi còn đủ sản phẩm trước khi tạo clip đầu tiên.</p>}
          {blockedByMotion && <p className="text-xs text-amber-200">Chưa tạo clip: ảnh chưa xác định đủ đường tiếp cận, khoảng trống hoặc mặt đỡ. Chọn ảnh khác rõ cấu tạo hơn, hoặc nhập MP4 đã có.</p>}
          <label className="flex gap-2 text-xs text-neutral-300"><input type="checkbox" disabled={busy || disabled || gate === 'review' || needsReferenceReview || blockedByPlanningError || blockedByMotion || blockedByLocalLimit} checked={confirm} onChange={event => setConfirm(event.target.checked)} />{gate === 'batch' ? `Tạo tối đa ${missing} clip còn thiếu` : 'Chỉ tạo một clip kiểm tra'} bằng hạn mức Google hiện có. Không tự tạo lại khi lỗi.</label>
          <button type="button" onClick={generate} disabled={busy || preparing || disabled || gate === 'review' || needsReferenceReview || blockedByPlanningError || blockedByMotion || blockedByLocalLimit || !confirm || !/^[a-f0-9]{64}$/.test(token.trim())} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Đang xử lý clip…' : gate === 'sample' ? 'Thử 1 clip / tiếp tục tác vụ' : 'Tạo clip còn thiếu / tiếp tục tác vụ'}</button>
        </div>}
        {notice && <p role="status" className="text-xs leading-relaxed text-amber-200">{notice}</p>}
    </>}
  </section>
}
