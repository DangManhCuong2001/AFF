import type {ContentPlan} from '@/engines/planning/types'
const labels = {'design-showcase': 'Giới thiệu thiết kế', 'feature-explainer': 'Giải thích thông tin', 'buying-guide': 'Hướng dẫn chọn mua', 'problem-solution': 'Nhu cầu và giải pháp'}
const outcomes = {auth: 'Lỗi key/quyền truy cập', quota: 'Giới hạn yêu cầu/quota', service: 'Dịch vụ không khả dụng', request: 'Yêu cầu bị từ chối', timeout: 'Quá thời gian chờ', blocked: 'Phản hồi bị chặn', 'output-limit': 'JSON bị cắt', 'invalid-response': 'JSON/kết nối không hợp lệ', 'invalid-content': 'Kịch bản không hợp lệ', completed: 'Hoàn tất', partial: 'Dùng một phần kết quả'}
export function ContentPlanSummary({plan, actualDuration, onRetry, retrying}: {plan: ContentPlan; actualDuration?: number; onRetry?: () => void; retrying?: boolean}) {
  return <div className="rounded-2xl border border-emerald-500/30 bg-neutral-900 p-5 space-y-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-emerald-300">Kế hoạch theo sản phẩm của bạn</h3><span className="text-neutral-400">{plan.source === 'gemini' ? 'Gemini hỗ trợ' : 'Nội dung theo đầu vào'} · {actualDuration ? `${actualDuration.toFixed(1)}s theo giọng đọc` : `${plan.recommendedDuration}s dự kiến`}</span></div>
    {plan.durationPlan && <div className="rounded-xl bg-neutral-950 p-3 text-neutral-300 space-y-1">
      <p className="font-semibold">{plan.durationPlan.mode === 'auto' ? plan.durationPlan.source === 'gemini' ? `Gemini gợi ý ${plan.durationPlan.modelSuggestedSeconds ?? plan.durationPlan.suggestedSeconds}s` : 'Tự động theo dữ liệu đầu vào' : `Mốc bạn chọn: ${plan.durationPlan.requestedSeconds}s`} · Kế hoạch {plan.durationPlan.suggestedSeconds}s</p>
      <p className="text-neutral-400">{plan.durationPlan.reason}</p>
      <p className="text-neutral-400">{actualDuration ? `Thời lượng theo giọng đọc: ${actualDuration.toFixed(1)}s. Preview và bản xuất dùng thời lượng này.` : 'Đây là thời lượng ước tính. Sau khi tạo giọng, preview và bản xuất cập nhật theo âm thanh thực tế.'}</p>
    </div>}
    <p className="text-white font-semibold">{labels[plan.format]}</p>
    <p className="text-neutral-400">{plan.formatReason}</p>
    {plan.aiStatus && <p role="status" className={plan.aiStatus.state === 'completed' ? 'text-emerald-300' : 'text-amber-300'}>{plan.aiStatus.message}</p>}
    {!!plan.aiStatus?.attempts?.length && <details className="text-neutral-400">
      <summary className="cursor-pointer">Chi tiết lần phân tích Gemini</summary>
      <ul className="mt-2 space-y-1">{plan.aiStatus.attempts.map((attempt, index) => <li key={`${attempt.model}-${index}`}>{attempt.stage ? `${attempt.stage === 'vision' ? 'Đọc ảnh' : 'Viết nội dung'} · ` : ''}{attempt.model}: {outcomes[attempt.outcome]}{attempt.httpStatus ? ` · HTTP ${attempt.httpStatus}` : ''} · {(attempt.elapsedMs / 1000).toFixed(1)}s</li>)}</ul>
    </details>}
    {onRetry && plan.aiStatus && plan.aiStatus.state !== 'completed' && <button type="button" onClick={onRetry} disabled={retrying} className="rounded-lg bg-neutral-800 px-3 py-2 text-white disabled:opacity-50">{retrying ? 'Đang phân tích...' : 'Phân tích lại với Gemini'}</button>}
    {plan.buyingProfile && <p className="text-neutral-300"><strong>{plan.buyingProfile.label}:</strong> {plan.buyingProfile.checks.join(' · ')}. Ưu tiên thông tin đã có trong sản phẩm.</p>}
    {plan.copySources && <div className="flex flex-wrap gap-2 text-[11px] text-neutral-300">
      {([['Hook', plan.copySources.hooks], ['Lời đọc', plan.copySources.script], ['CTA', plan.copySources.cta]] as const).map(([label, source]) => <span key={label} className="rounded-md bg-neutral-950 px-2 py-1">{label}: {source === 'gemini' ? 'Gemini' : source === 'mixed' ? 'Gemini + dự phòng' : 'Theo dữ liệu đầu vào'}</span>)}
    </div>}
    <p className="text-neutral-300"><strong>Trọng tâm:</strong> {plan.primaryBuyingReason}</p>
    {plan.message ? <div className="space-y-2 rounded-xl bg-neutral-950 p-3 text-neutral-300">
      <p><strong>Nhu cầu người xem:</strong> {plan.message.viewerNeed}</p>
      <p><strong>Video giải đáp:</strong> {plan.message.answer}</p>
      <p><strong>Bước tiếp theo:</strong> {plan.message.nextStep}</p>
      {plan.message.proof.length > 0 && <ul className="space-y-1 text-neutral-400">{plan.message.proof.map((proof) => <li key={`${proof.sceneId}-${proof.factId}`}>{proof.kind === 'image' ? 'Ảnh minh họa' : 'Thông tin từ mô tả'}: {plan.facts.find((fact) => fact.id === proof.factId)?.text}</li>)}</ul>}
    </div> : <>
      {plan.buyerQuestion && <p className="text-neutral-300"><strong>Câu hỏi cần giải đáp:</strong> {plan.buyerQuestion}</p>}
      {plan.clickReason && <p className="text-neutral-300"><strong>Lý do nhấn sản phẩm:</strong> {plan.clickReason}</p>}
    </>}
    <p className="text-neutral-400">{plan.aiStatus ? `${plan.images.length} ảnh sản phẩm · ${plan.aiStatus.attachedImages} ảnh đính kèm yêu cầu Gemini · ${plan.images.filter((image) => image.source === 'vision').length} ảnh có kết quả phân tích hợp lệ.` : `Đã đọc nội dung ${plan.images.filter((image) => image.source === 'vision').length}/${plan.images.length} ảnh.`} Các thông tin còn lại lấy từ mô tả và thông số đã lọc.</p>
    {plan.warnings.length > 0 && <ul className="space-y-1 text-amber-300 list-disc pl-4">{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    {plan.missingInformation.length > 0 && <p className="text-neutral-400">Bổ sung để nội dung cụ thể hơn: {plan.missingInformation.join(' · ')}.</p>}
    <p className="text-neutral-500">Kế hoạch giúp tổ chức nội dung; hiệu quả xem và mua cần đo sau khi đăng.</p>
  </div>
}
