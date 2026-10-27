import type {TikTokPostingMode} from '@/lib/tiktok/posting-mode'

export function TikTokPostingModeSelector({value, onChange, disabled}: {value: TikTokPostingMode; onChange: (mode: TikTokPostingMode) => void; disabled?: boolean}) {
  return <fieldset className="space-y-2" disabled={disabled}>
    <legend className="text-xs font-semibold text-neutral-300 mb-2">Cách gửi video</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {([
        {mode: 'publish', title: 'Đăng trực tiếp', description: 'Chọn caption và chế độ hiển thị tại đây, sau đó gửi yêu cầu xuất bản.'},
        {mode: 'upload', title: 'Chuyển vào Inbox TikTok', description: 'Mở thông báo trong TikTok để chỉnh sửa và tự hoàn tất đăng.'},
      ] as const).map((option) => <label key={option.mode} className={`flex gap-2 rounded-xl border p-3 text-xs cursor-pointer ${value === option.mode ? 'border-rose-500 bg-rose-950/30' : 'border-neutral-800 bg-neutral-900'} ${disabled ? 'opacity-60' : ''}`}>
        <input type="radio" name="tiktok-posting-mode" value={option.mode} checked={value === option.mode} onChange={() => onChange(option.mode)} className="mt-0.5 accent-rose-500" />
        <span><span className="block font-semibold text-white">{option.title}</span><span className="block text-neutral-400 leading-relaxed mt-1">{option.description}</span></span>
      </label>)}
    </div>
  </fieldset>
}
