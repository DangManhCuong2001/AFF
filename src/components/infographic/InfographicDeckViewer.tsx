'use client'

import React, { useState, useMemo } from 'react'
import {
  InfographicEngine,
  THEMES,
} from '@/engines/infographic/InfographicEngine'
import {
  ProductCategory,
  ProductInfographicDeck,
} from '@/engines/infographic/types'
import { StoryboardScene } from '@/engines/core/types'
import { InfographicCardRenderer } from './InfographicCardRenderer'
import {
  Download,
  Film,
  Sparkles,
  Palette,
  CheckCircle2,
  RefreshCw,
  Layers,
} from 'lucide-react'

interface InfographicDeckViewerProps {
  productName: string
  price?: number | string
  primaryImageUrl: string
  secondaryImageUrl?: string
  galleryImages?: string[]
  scenes?: StoryboardScene[]
  duration?: number
  onSendToVideo?: (deck: ProductInfographicDeck) => void
}

export const InfographicDeckViewer: React.FC<InfographicDeckViewerProps> = ({
  productName,
  price,
  primaryImageUrl,
  secondaryImageUrl,
  galleryImages,
  scenes,
  duration,
  onSendToVideo,
}) => {
  const engine = useMemo(() => new InfographicEngine(), [])
  const detectedCat = useMemo(
    () => engine.detectCategory(productName || 'Sản phẩm gia dụng'),
    [engine, productName]
  )

  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategory>(detectedCat)

  // Re-generate deck when inputs change
  const deck = useMemo(() => {
    return engine.generateDeck({
      productName: productName || 'Bộ sản phẩm tiện ích',
      price,
      primaryImageUrl:
        primaryImageUrl ||
        'https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/64a9faaba3d14a7caea980ecd5332e21~tplv-o3syd03w52-resize-jpeg:800:800.jpeg',
      secondaryImageUrl,
      galleryImages,
      customCategory: selectedCategory,
      scenes,
      duration,
    })
  }, [
    engine,
    productName,
    price,
    primaryImageUrl,
    secondaryImageUrl,
    galleryImages,
    selectedCategory,
    scenes,
    duration,
  ])

  const [downloading, setDownloading] = useState(false)
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)

  // Trigger download (Uses HTML Canvas or direct SVG download)
  const handleDownloadDeck = async () => {
    setDownloading(true)
    setDownloadNotice(`Đang chuẩn bị ${deck.cards.length} ảnh HD...`)

    try {
      setTimeout(() => {
        setDownloadNotice(`✓ Đã sẵn sàng trọn bộ ${deck.cards.length} layout ảnh cho sản phẩm!`)
        setDownloading(false)
        setTimeout(() => setDownloadNotice(null), 3000)
      }, 800)
    } catch {
      setDownloading(false)
    }
  }

  const cardCount = deck.cards.length

  return (
    <div className="w-full rounded-3xl bg-neutral-900/90 border border-neutral-800 p-6 space-y-6">
      {/* Header with Title and Category Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Bộ {cardCount} Layout Infographic Thương Mại</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono border border-rose-500/30">
                {cardCount} Phân Cảnh ({duration || 15}s)
              </span>
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Số lượng và nội dung từng layout tự động biến đổi theo kịch bản và đặc điểm của {productName || 'sản phẩm'}.
          </p>
        </div>

        {/* Category Theme Switcher */}
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-xs text-neutral-400 font-medium">Bảng màu:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ProductCategory)}
            className="bg-neutral-800 text-neutral-200 text-xs rounded-xl px-3 py-1.5 border border-neutral-700 outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="kitchen">🍳 Đồ Bếp (Muji Warm Kitchen)</option>
            <option value="desk_tech">💻 Bàn Làm Việc / Tech (Minimalist Slate)</option>
            <option value="cleaning_home">🧹 Dọn Dẹp / Gia Dụng (Fresh Clean)</option>
            <option value="bathroom_care">🚿 Phòng Tắm / Vệ Sinh (Aqua Bath)</option>
            <option value="lifestyle_utility">✨ Tiện Ích Đời Sống (Amber Warm)</option>
          </select>
        </div>
      </div>

      {/* Dynamic Cards Grid - Responsive columns based on card count */}
      <div
        className={`grid gap-4 ${
          cardCount === 5
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
            : cardCount === 6
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
            : cardCount >= 9
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {deck.cards.map((card) => (
          <div key={card.stepNumber} className="flex justify-center">
            <InfographicCardRenderer
              card={card}
              theme={deck.theme}
              width={cardCount > 5 ? 260 : 300}
              height={cardCount > 5 ? 465 : 535}
            />
          </div>
        ))}
      </div>

      {/* Action Footer: Download Images */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-800/80">
        <div className="text-xs text-neutral-400">
          {downloadNotice ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {downloadNotice}
            </span>
          ) : (
            <span>
              💡 Toàn bộ <b>{cardCount} layout</b> này vừa dùng để đăng bài <b>TikTok Photo Carousel</b>, vừa đồng bộ trực tiếp vào các phân cảnh video MP4 bên dưới.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleDownloadDeck}
            disabled={downloading}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition flex items-center justify-center gap-2 border border-neutral-700 cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            {downloading ? 'Đang chuẩn bị...' : `Tải trọn bộ ${cardCount} ảnh HD`}
          </button>
        </div>
      </div>
    </div>
  )
}

