import React from 'react'
import {TIKTOK_FRAME, TIKTOK_SAFE} from '@/remotion/tiktok-layout'

/** Browser-only sibling of the player/video. Never included in Remotion input props. */
export function TikTokPreviewOverlay({mode}: {mode: 'tiktok' | 'guides'}) {
  const {width, height} = TIKTOK_FRAME
  const {left, right, top, bottom} = TIKTOK_SAFE
  return <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full pointer-events-none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, fontFamily: 'Arial, sans-serif'}}>
    {mode === 'guides' ? <>
      <path d={`M0 0H${width}V${height}H0Z M${left} ${top}V${height - bottom}H${width - right}V${top}Z`} fill="#f59e0b" fillOpacity="0.16" fillRule="evenodd" />
      <rect x={left} y={top} width={width - left - right} height={height - top - bottom} rx="8" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="14 10" />
      <text x="120" y="196" fill="#fff" stroke="#111" strokeWidth="1" fontSize="30">Vùng an toàn cho nội dung chính</text>
      <text x="120" y="1360" fill="#fff" stroke="#111" strokeWidth="1" fontSize="28">Chừa chỗ cho caption / giỏ hàng</text>
    </> : <>
      <defs><linearGradient id="tiktok-preview-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.72" /></linearGradient></defs>
      <rect x="0" y="1280" width={width} height="640" fill="url(#tiktok-preview-shade)" />
      <rect x="0" y="0" width={width} height="180" fill="#000" fillOpacity="0.16" />
      <text x="540" y="130" textAnchor="middle" fill="white" fontSize="38" fontWeight="700">Đang Follow　 Dành cho bạn</text>
      <g fill="white" textAnchor="middle" fontSize="38">
        <circle cx="985" cy="790" r="44" fill="#ffffffaa" />
        <text x="985" y="958" fontSize="72">♥</text><text x="985" y="1002" fontSize="27">1.2K</text>
        <text x="985" y="1114" fontSize="64">●</text><text x="985" y="1158" fontSize="27">Bình luận</text>
        <text x="985" y="1266" fontSize="64">↗</text><text x="985" y="1310" fontSize="27">Chia sẻ</text>
      </g>
      <g fill="white" fontSize="32">
        <rect x="48" y="1390" width="390" height="64" rx="12" fill="#343434" /><text x="70" y="1433">▣  Xem sản phẩm</text>
        <text x="48" y="1530" fontSize="38" fontWeight="700">@ten_kenh</text>
        <text x="48" y="1590">Mô tả sản phẩm và nội dung video…</text>
        <text x="48" y="1640">#sanpham #tiktokshop</text>
        <text x="48" y="1730">♫  Âm thanh của video</text>
      </g>
    </>}
  </svg>
}
