'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Link as LinkIcon,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Film,
  Layers,
  ArrowRight,
  Trash2,
  Star,
  RefreshCw,
  Clock,
} from 'lucide-react'
import {
  ProductInput,
  ProductCategory,
  ProductAsset,
  ProductAssetType,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
} from '@/engines/core/types'
import { CABLE_ORGANIZER_SEED_PRODUCT } from '@/engines/home/seed'

interface CategoryTab {
  id: ProductCategory
  name: string
  icon: string
  isActive: boolean
  description: string
}

const CATEGORY_TABS: CategoryTab[] = [
  {
    id: 'home',
    name: 'Home & Utility',
    icon: '🏠',
    isActive: true,
    description: 'Đồ gia dụng, dọn dẹp, sắp xếp, ngăn kéo, tiện ích bàn học & nhà tắm',
  },
  {
    id: 'fashion',
    name: 'Fashion',
    icon: '👗',
    isActive: false,
    description: 'Quần áo, trang phục, dáng người, chất liệu (Coming soon)',
  },
  {
    id: 'accessories',
    name: 'Accessories',
    icon: '👜',
    isActive: false,
    description: 'Túi xách, trang sức, đồng hồ, phụ kiện mang theo (Coming soon)',
  },
  {
    id: 'beauty',
    name: 'Beauty & Skincare',
    icon: '💄',
    isActive: false,
    description: 'Mỹ phẩm, dưỡng da, chất kem, liệu trình (Coming soon)',
  },
  {
    id: 'perfume',
    name: 'Perfume',
    icon: '🌸',
    isActive: false,
    description: 'Nước hoa, tông mùi, phong cách, độ lưu hương (Coming soon)',
  },
  {
    id: 'tech',
    name: 'Tech Gadget',
    icon: '⚡',
    isActive: false,
    description: 'Thiết bị công nghệ, phụ kiện thông minh, bàn làm việc (Coming soon)',
  },
]

export default function CreateVideoPage() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('home')
  const [inputMode, setInputMode] = useState<'url' | 'manual'>('manual')

  // URL Import State
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [importingUrl, setImportingUrl] = useState(false)
  const [importNotice, setImportNotice] = useState<{ message: string; requiresFallback: boolean } | null>(null)

  // Product Form State
  const [product, setProduct] = useState<ProductInput>({
    id: 'prod-draft',
    name: '',
    category: 'home',
    price: '',
    originalPrice: '',
    currency: 'VND',
    description: '',
    problemSolved: '',
    benefits: [''],
    features: [''],
    howToUse: '',
    targetAudience: '',
    productUrl: '',
    assets: [],
  })

  // Analysis & Engine State
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: ProductAnalysis
    strategy: VideoStrategy
    storyboard: VideoStoryboard
  } | null>(null)

  // Load Seed Product
  const handleLoadSeed = () => {
    setProduct({
      ...CABLE_ORGANIZER_SEED_PRODUCT,
      id: 'prod-seed',
    })
    setImportNotice(null)
    setAnalysisResult(null)
  }

  // Handle TikTok Shop URL Import
  const handleImportUrl = async () => {
    if (!tiktokUrl.trim()) return
    setImportingUrl(true)
    setImportNotice(null)

    try {
      const res = await fetch('/api/products/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tiktokUrl }),
      })
      const data = await res.json()

      if (data.requiresManualFallback) {
        setImportNotice({
          message: data.message,
          requiresFallback: true,
        })
        setInputMode('manual')
        if (data.product?.productUrl) {
          setProduct((prev) => ({
            ...prev,
            productUrl: data.product.productUrl,
            shopProductId: data.product.shopProductId,
          }))
        }
      } else if (data.success && data.product) {
        setProduct((prev) => ({
          ...prev,
          ...data.product,
        }))
        setInputMode('manual')
      } else {
        setImportNotice({
          message: data.message || 'Không thể nhập dữ liệu từ URL này.',
          requiresFallback: true,
        })
      }
    } catch {
      setImportNotice({
        message: 'Lỗi kết nối khi kiểm tra đường dẫn TikTok Shop.',
        requiresFallback: true,
      })
    } finally {
      setImportingUrl(false)
    }
  }

  // Handle Asset Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAssets: ProductAsset[] = Array.from(files).map((file, idx) => {
      const isVideo = file.type.startsWith('video/')
      const defaultType: ProductAssetType = isVideo ? 'PRODUCT_VIDEO' : 'PRODUCT_IMAGE'
      const url = URL.createObjectURL(file)

      return {
        id: 'asset-' + Date.now() + '-' + idx,
        name: file.name,
        size: file.size,
        type: defaultType,
        url,
        file,
        isPrimary: product.assets.length === 0 && idx === 0,
      }
    })

    setProduct((prev) => ({
      ...prev,
      assets: [...prev.assets, ...newAssets],
    }))

    // Reset input
    e.target.value = ''
  }

  // Set Primary Asset
  const handleSetPrimary = (assetId: string) => {
    setProduct((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => ({
        ...a,
        isPrimary: a.id === assetId,
      })),
    }))
  }

  // Remove Asset
  const handleRemoveAsset = (assetId: string) => {
    setProduct((prev) => {
      const remaining = prev.assets.filter((a) => a.id !== assetId)
      if (remaining.length > 0 && !remaining.some((a) => a.isPrimary)) {
        remaining[0].isPrimary = true
      }
      return { ...prev, assets: remaining }
    })
  }

  // Update Asset Type
  const handleUpdateAssetType = (assetId: string, type: ProductAssetType) => {
    setProduct((prev) => ({
      ...prev,
      assets: prev.assets.map((a) => (a.id === assetId ? { ...a, type } : a)),
    }))
  }

  // Execute AI Product Analysis
  const handleAnalyzeProduct = async () => {
    if (!product.name.trim()) {
      alert('Vui lòng nhập tên sản phẩm trước khi phân tích.')
      return
    }

    setAnalyzing(true)
    try {
      const res = await fetch('/api/engines/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Phân tích sản phẩm thất bại')
        return
      }

      setAnalysisResult({
        analysis: data.analysis,
        strategy: data.strategy,
        storyboard: data.storyboard,
      })
    } catch (err: unknown) {
      alert('Lỗi: ' + (err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans selection:bg-rose-500/30 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="border-b border-neutral-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  AI Product Video Platform
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                    Home Engine Active
                  </span>
                </h1>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Tự động phân tích sản phẩm, lên kịch bản TikTok UGC &amp; xuất video với độ chân thực cao
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/tiktok-test"
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition flex items-center gap-1.5 text-neutral-300"
            >
              <Film className="w-3.5 h-3.5 text-rose-400" />
              TikTok Direct Post Pipeline
            </Link>
          </div>
        </header>

        {/* Section 5: Category Engine Selector Tabs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Chọn Ngành Hàng (Category Engine)
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              Architecture Ready for 6 Vertical Engines
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (cat.isActive) setSelectedCategory(cat.id)
                }}
                className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  cat.isActive && selectedCategory === cat.id
                    ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/20 text-white'
                    : cat.isActive
                    ? 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    : 'bg-neutral-950/40 border-neutral-800/50 text-neutral-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <div>
                  <div className="text-2xl mb-1.5">{cat.icon}</div>
                  <div className="font-semibold text-xs flex items-center gap-1">
                    {cat.name}
                  </div>
                </div>

                <div className="mt-3">
                  {cat.isActive ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-500">
                      Coming soon
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500 italic">
            * Hiện tại <strong>Home &amp; Utility Engine</strong> đang kích hoạt. Các engine khác (Thời trang, Mỹ phẩm, Nước hoa...) kế thừa kiến trúc và sẽ bổ sung tiếp theo.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="font-semibold">Nhập sản phẩm</span>
          </div>
          <div className={`p-3 rounded-xl border flex items-center gap-2 ${
            analysisResult ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-neutral-900/40 border-neutral-800 text-neutral-500'
          }`}>
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>AI Phân tích</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-neutral-500 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Tạo Video (Phase 3+)</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-neutral-500 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold">4</span>
            <span>Preview &amp; Đăng TikTok</span>
          </div>
        </div>

        {/* Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Product Inputs & Assets (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Input Mode Selector & Seed Shortcut */}
            <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      inputMode === 'manual'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Nhập tay thông tin (Mode B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      inputMode === 'url'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Dán link TikTok Shop (Mode A)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLoadSeed}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Nạp mẫu Demo: Kẹp dây sạc 39k
                </button>
              </div>

              {/* Mode A: TikTok Shop URL Import Form */}
              {inputMode === 'url' && (
                <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-3">
                  <label className="text-xs font-medium text-neutral-300 block">
                    Đường dẫn sản phẩm TikTok Shop (Product URL):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={tiktokUrl}
                      onChange={(e) => setTiktokUrl(e.target.value)}
                      placeholder="https://shop.tiktok.com/view/product/..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleImportUrl}
                      disabled={importingUrl}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition shrink-0 flex items-center gap-1.5"
                    >
                      {importingUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      IMPORT PRODUCT
                    </button>
                  </div>

                  {importNotice && (
                    <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{importNotice.message}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Manual Product Details Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-neutral-300 block">
                      Tên sản phẩm <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => setProduct({ ...product, name: e.target.value })}
                      placeholder="VD: Miếng kẹp giữ cố định dây sạc silicon 5 rãnh"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300 block">
                      Giá bán (VND)
                    </label>
                    <input
                      type="text"
                      value={product.price || ''}
                      onChange={(e) => setProduct({ ...product, price: e.target.value })}
                      placeholder="VD: 39000"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Problem Solved - Core for Hook */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Vấn đề khó chịu mà sản phẩm giải quyết (Problem Solved) *
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">Dùng để tạo 3s Hook đầu</span>
                  </div>
                  <textarea
                    rows={2}
                    value={product.problemSolved || ''}
                    onChange={(e) => setProduct({ ...product, problemSolved: e.target.value })}
                    placeholder="VD: Dây sạc thường xuyên rơi xuống gầm bàn mỗi khi rút máy làm bừa bộn và mất công cúi xuống nhặt."
                    className="w-full bg-neutral-950 border border-amber-900/40 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Benefits & Features */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lợi ích nổi bật (Benefits)
                    </label>
                    <textarea
                      rows={2}
                      value={product.benefits?.join('\n') || ''}
                      onChange={(e) => setProduct({ ...product, benefits: e.target.value.split('\n') })}
                      placeholder="Mỗi dòng 1 lợi ích:&#10;- Giữ nhiều dây cố định mép bàn&#10;- Bàn làm việc thẩm mỹ tức thì"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300">
                      Đặc điểm kỹ thuật (Features)
                    </label>
                    <textarea
                      rows={2}
                      value={product.features?.join('\n') || ''}
                      onChange={(e) => setProduct({ ...product, features: e.target.value.split('\n') })}
                      placeholder="Mỗi dòng 1 đặc điểm:&#10;- Silicon mềm dẻo không gãy dây&#10;- Băng dính 3M siêu dính"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500 font-sans"
                    />
                  </div>
                </div>

                {/* Target Audience & How to use */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300">
                      Cách sử dụng (How to use)
                    </label>
                    <input
                      type="text"
                      value={product.howToUse || ''}
                      onChange={(e) => setProduct({ ...product, howToUse: e.target.value })}
                      placeholder="VD: Lau sạch mép bàn, bóc lớp dán và ấn chặt 10s"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-300">
                      Đối tượng khách hàng (Target audience)
                    </label>
                    <input
                      type="text"
                      value={product.targetAudience || ''}
                      onChange={(e) => setProduct({ ...product, targetAudience: e.target.value })}
                      placeholder="VD: Dân văn phòng, người làm việc tại nhà"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 9 & 10: Product Assets & Real Product First Rule */}
            <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-neutral-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Kho Media Sản Phẩm Thật ({product.assets.length} file)
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Nguyên tắc Real Product First: AI luôn sử dụng hình ảnh thật của bạn để giữ nguyên vẹn sản phẩm.
                  </p>
                </div>

                <label className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer transition flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-rose-400" />
                  Tải thêm ảnh/video
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {product.assets.length === 0 ? (
                <label className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-neutral-950/40">
                  <UploadCloud className="w-8 h-8 text-neutral-500 mb-2" />
                  <p className="text-xs font-semibold text-neutral-300">
                    Kéo thả hoặc bấm để chọn ảnh/video sản phẩm
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Hỗ trợ JPG, PNG, WebP, MP4, MOV (Ưu tiên ảnh chụp rõ nét hoặc clip quay thật)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {product.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`group relative rounded-xl border p-2 bg-neutral-950 flex flex-col justify-between transition ${
                        asset.isPrimary ? 'border-amber-500/80 ring-1 ring-amber-500/30' : 'border-neutral-800'
                      }`}
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-900 mb-2">
                        {asset.type === 'PRODUCT_VIDEO' || asset.type === 'DEMO_VIDEO' ? (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400">
                            <Film className="w-6 h-6 text-rose-400" />
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {asset.isPrimary && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 text-[10px] font-bold flex items-center gap-0.5 shadow">
                            <Star className="w-2.5 h-2.5 fill-current" /> PRIMARY
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] text-neutral-300 truncate font-mono" title={asset.name}>
                          {asset.name}
                        </p>

                        <div className="flex items-center justify-between gap-1">
                          <select
                            value={asset.type}
                            onChange={(e) => handleUpdateAssetType(asset.id, e.target.value as ProductAssetType)}
                            className="bg-neutral-900 border border-neutral-800 text-[10px] rounded px-1.5 py-1 text-neutral-300 focus:outline-none"
                          >
                            <option value="PRODUCT_IMAGE">Ảnh chính</option>
                            <option value="DETAIL_IMAGE">Ảnh chi tiết</option>
                            <option value="PRODUCT_VIDEO">Video sản phẩm</option>
                            <option value="DEMO_VIDEO">Video demo thật</option>
                          </select>

                          <div className="flex items-center gap-1">
                            {!asset.isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimary(asset.id)}
                                title="Đặt làm ảnh đại diện chính"
                                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveAsset(asset.id)}
                              title="Xóa asset"
                              className="p-1 rounded hover:bg-rose-950/40 text-neutral-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Trigger Button */}
            <button
              type="button"
              onClick={handleAnalyzeProduct}
              disabled={analyzing || !product.name}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang phân tích cấu trúc sản phẩm với Home Engine...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Phân tích sản phẩm &amp; Lập kế hoạch Video (Analyze Product)
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Right Column: AI Analysis & Storyboard Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {analysisResult ? (
              <div className="space-y-6">
                {/* Analysis Card */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-rose-500/30 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Home &amp; Utility Engine Strategy
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                      {analysisResult.strategy.format.toUpperCase()}
                    </span>
                  </div>

                  {/* Hook & Angle */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
                    <span className="text-[11px] font-semibold text-amber-300 block">
                      🎯 3-Second Organic TikTok Hook:
                    </span>
                    <p className="text-xs text-white font-medium leading-relaxed italic">
                      &quot;{analysisResult.strategy.hook}&quot;
                    </p>
                  </div>

                  {/* Core Mechanism & Benefits */}
                  <div className="text-xs space-y-2 text-neutral-300">
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-500">Cơ chế bán hàng:</span>
                      <span className="font-semibold text-neutral-200">{analysisResult.analysis.sellingMechanism}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-500">Thời lượng dự kiến:</span>
                      <span className="font-semibold text-rose-400 font-mono">{analysisResult.strategy.targetDuration}s (Chuẩn TikTok)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-neutral-800">
                      <span className="text-neutral-500">Visual Potential:</span>
                      <span className="font-semibold text-emerald-400 capitalize">{analysisResult.analysis.visualDemoPotential}</span>
                    </div>
                  </div>

                  {/* Format details */}
                  <div className="p-3 rounded-lg bg-neutral-950/70 text-[11px] text-neutral-400 border border-neutral-800/80">
                    <span className="font-semibold text-neutral-300 block mb-1">
                      Lý do chọn format:
                    </span>
                    {analysisResult.analysis.reasoningSummary}
                  </div>
                </div>

                {/* Storyboard Timeline */}
                <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-neutral-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-rose-400" />
                      Storyboard Phân Cảnh (15 Giây)
                    </h3>
                    <span className="text-xs text-neutral-500 font-mono">
                      {analysisResult.storyboard.scenes.length} Scenes
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {analysisResult.storyboard.scenes.map((scene, idx) => (
                      <div
                        key={scene.id}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-400 text-[11px] flex items-center gap-1.5">
                            Scene {idx + 1} • {scene.type.toUpperCase()}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                            {scene.duration}s
                          </span>
                        </div>

                        <div>
                          <p className="font-semibold text-white text-xs">{scene.headline}</p>
                          {scene.subheadline && (
                            <p className="text-[11px] text-neutral-400">{scene.subheadline}</p>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-neutral-900 text-[11px] text-neutral-400 italic">
                          🗣️ Voice: &quot;{scene.voice}&quot;
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <span>Trạng thái: <strong>Kịch bản sẵn sàng</strong></span>
                    <span className="font-mono text-[11px]">Phase 3 Engine Connected</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 flex items-center justify-center mx-auto text-neutral-400">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-neutral-200">Chưa có bản phân tích</h3>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mt-1 leading-relaxed">
                    Nhập thông tin sản phẩm và bấm nút &quot;Phân tích sản phẩm&quot; hoặc bấm nút nạp mẫu demo phía trên để xem kịch bản TikTok UGC tức thì.
                  </p>
                </div>

                <div className="pt-4 border-t border-neutral-800/60 text-left text-xs text-neutral-400 space-y-2">
                  <span className="font-semibold text-neutral-300 block">Quy trình tự động của Home Engine:</span>
                  <div className="space-y-1.5 pl-2 border-l border-neutral-800">
                    <p>1. Xác định vấn đề khó chịu (Problem) &amp; đối tượng mua</p>
                    <p>2. Chọn format tối ưu (Problem-Solution / Before-After / Demo)</p>
                    <p>3. Viết Hook tự nhiên như người dùng thật (Organic UGC)</p>
                    <p>4. Ghép nối sản phẩm thật với phối cảnh thông minh</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
