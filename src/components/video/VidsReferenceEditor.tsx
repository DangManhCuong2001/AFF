'use client'

import {useState} from 'react'
import Image from 'next/image'
import type {ReferenceCrop} from '@/lib/video/vids-reference'
import {validReferenceCrop} from '@/lib/video/vids-reference'

interface Props {
  original: string
  suggested?: ReferenceCrop
  disabled: boolean
  onApply: (crop?: ReferenceCrop, file?: File) => void
}
export function VidsReferenceEditor({original, suggested, disabled, onApply}: Props) {
  const [crop, setCrop] = useState<ReferenceCrop>(suggested || {x: 0, y: 0, width: 100, height: 100})
  const valid = validReferenceCrop(crop)
  return <details className="text-xs text-neutral-400">
    <summary>Chuẩn bị ảnh sạch: cắt banner / thay ảnh</summary>
    <div className="mt-3 space-y-3">
      <p>Chỉ cắt một bản sao, không vẽ lại sản phẩm. Sau đó app đặt ảnh lên canvas dọc 9:16 mà không kéo giãn, để Vids ít phải tự đổi tỷ lệ sản phẩm. Khung Gemini gợi ý có thể chưa chính xác; giữ đủ mọi chi tiết, phụ kiện và logo thật trên sản phẩm.</p>
      <div className="relative w-full overflow-hidden rounded-lg bg-neutral-900">
        <Image src={original} alt="Ảnh gốc và khung cắt tham chiếu" unoptimized width={1000} height={1000} className="block w-full h-auto" />
        {valid && <div aria-hidden="true" className="pointer-events-none absolute border-2 border-emerald-400" style={{left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%`}} />}
      </div>
      <fieldset disabled={disabled} className="grid grid-cols-2 gap-2">
        {([['x', 'Trái (%)'], ['y', 'Trên (%)'], ['width', 'Rộng (%)'], ['height', 'Cao (%)']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min={0} max={100} step={0.1} value={Number.isFinite(crop[key]) ? Number(crop[key].toFixed(1)) : ''} onChange={event => setCrop(previous => ({...previous, [key]: event.target.valueAsNumber}))} className="mt-1 w-full min-w-0 rounded border border-neutral-700 bg-neutral-900 p-2" /></label>)}
      </fieldset>
      {!valid && <p className="text-amber-200">Khung cắt phải nằm trong ảnh và có chiều rộng, chiều cao lớn hơn 0.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || !valid} onClick={() => onApply(crop)} className="rounded-lg border border-emerald-700 px-3 py-2 text-emerald-200 disabled:opacity-40">Áp dụng khung cắt</button>
        <button type="button" disabled={disabled} onClick={() => onApply()} className="rounded-lg border border-neutral-700 px-3 py-2 disabled:opacity-40">Dùng lại ảnh gốc</button>
      </div>
      <label className="block">Hoặc tải ảnh sạch của đúng sản phẩm (PNG/JPEG/WebP, tối đa 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event => {const file = event.target.files?.[0]; if (file) onApply(undefined, file); event.target.value = ''}} className="mt-2 w-full text-[11px]" /></label>
      <p>Đổi ảnh tham chiếu sẽ tra lại clip theo ảnh mới và yêu cầu duyệt lại. Chưa gọi Google ở bước này.</p>
    </div>
  </details>
}
