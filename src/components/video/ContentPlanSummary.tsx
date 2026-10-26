import type {ContentPlan} from '@/engines/planning/types'
const labels = {'design-showcase': 'Giới thiệu thiết kế', 'feature-explainer': 'Giải thích thông tin', 'buying-guide': 'Hướng dẫn chọn mua', 'problem-solution': 'Nhu cầu và giải pháp'}
export function ContentPlanSummary({plan}: {plan: ContentPlan}) {
  return <div className="rounded-2xl border border-emerald-500/30 bg-neutral-900 p-5 space-y-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-emerald-300">Kế hoạch theo sản phẩm của bạn</h3><span className="text-neutral-400">{plan.source === 'gemini' ? 'Gemini hỗ trợ' : 'Nội dung theo đầu vào'} · {plan.recommendedDuration}s dự kiến</span></div>
    <p className="text-white font-semibold">{labels[plan.format]}</p>
    <p className="text-neutral-400">{plan.formatReason}</p>
    {plan.copySources && <div className="flex flex-wrap gap-2 text-[11px] text-neutral-300">
      {([['Hook', plan.copySources.hooks], ['Lời đọc', plan.copySources.script], ['CTA', plan.copySources.cta]] as const).map(([label, source]) => <span key={label} className="rounded-md bg-neutral-950 px-2 py-1">{label}: {source === 'gemini' ? 'Gemini' : source === 'mixed' ? 'Gemini + dự phòng' : 'Theo dữ liệu đầu vào'}</span>)}
    </div>}
    <p className="text-neutral-300"><strong>Trọng tâm:</strong> {plan.primaryBuyingReason}</p>
    {plan.buyerQuestion && <p className="text-neutral-300"><strong>Câu hỏi cần giải đáp:</strong> {plan.buyerQuestion}</p>}
    {plan.clickReason && <p className="text-neutral-300"><strong>Lý do nhấn sản phẩm:</strong> {plan.clickReason}</p>}
    <p className="text-neutral-400">Đã đọc nội dung {plan.images.filter((image) => image.source === 'vision').length}/{plan.images.length} ảnh. Các thông tin còn lại lấy từ dữ liệu bạn nhập.</p>
    {plan.warnings.length > 0 && <ul className="space-y-1 text-amber-300 list-disc pl-4">{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    {plan.missingInformation.length > 0 && <p className="text-neutral-400">Bổ sung để nội dung cụ thể hơn: {plan.missingInformation.join(' · ')}.</p>}
    <p className="text-neutral-500">Kế hoạch giúp tổ chức nội dung; hiệu quả xem và mua cần đo sau khi đăng.</p>
  </div>
}
