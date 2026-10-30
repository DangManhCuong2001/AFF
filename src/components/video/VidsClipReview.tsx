'use client'

import {useEffect, useRef, useState} from 'react'
import Image from 'next/image'
import {extractVidsReviewFrames, type VidsReviewFrame} from '@/lib/video/vids-review'
import {parseVidsFidelityReport, type VidsFidelityReport} from '@/lib/video/vids-fidelity'
import type {VidsPhysicalPath} from '@/lib/video/vids-physical-path'

export function VidsClipReview({src, frameAspect, reference, analysisSrc, expected, onReport}: {src: string; frameAspect?: number; reference?: string; analysisSrc?: string; expected?: {actionId: string; path: VidsPhysicalPath}; onReport?: (src: string, reference: string, report: VidsFidelityReport) => void}) {
  const reviewSource = analysisSrc || src
  const [result, setResult] = useState<{src: string; frameAspect?: number; frames?: VidsReviewFrame[]; error?: string}>()
  const [analysis, setAnalysis] = useState<{src: string; reference: string; busy?: boolean; report?: VidsFidelityReport; error?: string}>()
  const reviewController = useRef<AbortController | null>(null)
  useEffect(() => () => reviewController.current?.abort(), [src, reference, analysisSrc])
  useEffect(() => {
    const controller = new AbortController()
    void extractVidsReviewFrames(src, controller.signal, frameAspect).then(frames => {
      if (!controller.signal.aborted) setResult({src, frameAspect, frames})
    }).catch(error => {
      if (!controller.signal.aborted) setResult({src, frameAspect, error: error instanceof Error ? error.message : 'Chưa đọc được khung hình clip.'})
    })
    return () => controller.abort()
  }, [src, frameAspect])
  const current = result?.src === src && result?.frameAspect === frameAspect ? result : undefined
  const currentAnalysis = analysis?.src === reviewSource && analysis.reference === reference ? analysis : undefined
  const review = async () => {
    if (!reference || currentAnalysis?.busy) return
    reviewController.current?.abort()
    const controller = new AbortController()
    reviewController.current = controller
    setAnalysis({src: reviewSource, reference, busy: true})
    try {
      // Compare full source frames, even if the final composition uses a crop.
      const frames = await extractVidsReviewFrames(reviewSource, controller.signal, undefined, 640, 'physics')
      const response = await fetch('/api/experiments/vids', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'review', reference, frames: frames.map(frame => frame.src), expected}), signal: controller.signal})
      if (!response.ok) throw new Error('Chưa đối chiếu được bằng Gemini. Bạn vẫn có thể xem và kiểm tra clip; hệ thống không tạo lại tự động.')
      const value = await response.json()
      if (!controller.signal.aborted) {
        const report = parseVidsFidelityReport(value.report)
        setAnalysis({src: reviewSource, reference, report})
        onReport?.(reviewSource, reference, report)
      }
    } catch (error) {
      if (!controller.signal.aborted) setAnalysis({src: reviewSource, reference, error: error instanceof Error ? error.message : 'Chưa đối chiếu được clip.'})
    }
  }
  return <div className="space-y-2">
    <p className="text-[11px] text-neutral-400">Xem hết clip: tay tiếp cận từ đâu, vật đi qua lối mở nào, chạm đúng mặt đỡ rồi mới buông tay không? Có xuyên khay, nan hoặc thành sản phẩm không?</p>
    {current?.frames ? <div className="grid grid-cols-3 gap-2" data-vids-review="frames">{current.frames.map(frame => <figure key={frame.label} className="min-w-0"><Image src={frame.src} alt={`Khung ${frame.label.toLowerCase()} clip`} unoptimized width={320} height={320} className="w-full h-28 object-contain rounded bg-neutral-900" /><figcaption className="mt-1 text-center text-[10px] text-neutral-400">{frame.label} · {frame.seconds.toFixed(1)}s</figcaption></figure>)}</div> : <p className="text-[11px] text-neutral-500">{current?.error || 'Đang lấy khung hình từ clip đã lưu trên máy…'}</p>}
    <p className="text-[11px] text-neutral-500">Đây là ảnh trích để đối chiếu nhanh, chưa thay cho việc xem hết clip.</p>
    {reference && <button type="button" disabled={currentAnalysis?.busy} onClick={() => void review()} className="rounded border border-neutral-700 px-3 py-2 text-xs disabled:opacity-50">{currentAnalysis?.busy ? 'Gemini đang kiểm tra đường thao tác…' : 'Kiểm tra sản phẩm và đường thao tác bằng Gemini'}</button>}
    {reference && <p className="text-[11px] text-neutral-500">Đọc 12 khung liên tiếp bằng hạn mức Gemini, không tạo thêm clip Vids. Kết quả được lưu để dùng lại.</p>}
    {analysisSrc && <p className="text-[11px] text-neutral-500">Gemini đối chiếu toàn bộ clip gốc trước khi cắt mép.</p>}
    {currentAnalysis?.error && <p className="text-xs text-amber-300">{currentAnalysis.error}</p>}
    {currentAnalysis?.report && <div className="rounded border border-neutral-700 p-3 text-xs space-y-2">
      <p>{({'no-obvious-mismatch': 'Chưa thấy khác biệt rõ ở các khung đã kiểm tra.', mismatch: 'Có lỗi cần xử lý; chưa dùng clip này để ghép.', uncertain: 'Chưa đủ rõ để kết luận sản phẩm và thao tác được giữ đúng.'})[currentAnalysis.report.verdict]}</p>
      {currentAnalysis.report.issues.map((issue, index) => <p key={index}>Khung {issue.frameIndex + 1}/12: {issue.detail}</p>)}
      {currentAnalysis.report.entryEvidence && <p>Đường đi quan sát được: {currentAnalysis.report.entryEvidence}</p>}
      <p className={currentAnalysis.report.physics === 'violation' ? 'text-red-300' : 'text-amber-200'}>{({'plausible-in-samples': 'Chưa thấy lỗi vật lý rõ ở các khung đã đọc; vẫn cần xem toàn bộ chuyển động.', violation: 'Phát hiện lỗi tương tác vật lý. Clip bị chặn khỏi bước ghép.', unclear: 'Chưa xác định chắc đường tiếp cận, tiếp xúc hoặc buông tay. Cần tự xem kỹ đoạn thao tác.'})[currentAnalysis.report.physics]}</p>
      {currentAnalysis.report.motion !== 'meaningful' && <p className="text-amber-300">{currentAnalysis.report.motion === 'limited' ? 'Chuyển động còn hạn chế ở các khung đã kiểm tra.' : 'Chưa đánh giá được mức độ chuyển động từ các khung này.'}</p>}
      <p className="text-neutral-400">Kiểm tra khung hình có thể bỏ sót lỗi giữa hai thời điểm; bạn cần xem hết clip. Đây không phải kết quả tiền kiểm TikTok.</p>
    </div>}
  </div>
}
