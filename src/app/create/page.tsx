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
  Send,
  Download,
  Key,
  X,
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

  // Step Management: 1: Input | 2: Analysis | 3: Generating | 4: Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [generationProgress, setGenerationProgress] = useState<{
    stage: string
    percent: number
    logs: string[]
  }>({
    stage: 'idle',
    percent: 0,
    logs: [],
  })

  // Final Publish state
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [privacyLevel, setPrivacyLevel] = useState<'SELF_ONLY' | 'PUBLIC_TO_EVERYONE'>('SELF_ONLY')
  const [isAigc, setIsAigc] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{
    success: boolean
    publishId?: string
    message?: string
  } | null>(null)

  // Gemini API Key config
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || ''
    }
    return ''
  })
  const [tempApiKey, setTempApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || ''
    }
    return ''
  })
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  // Rendered video state
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null)
  const [renderedVideoFile, setRenderedVideoFile] = useState<File | null>(null)

  // Load Seed Product
  const handleLoadSeed = () => {
    setProduct({
      ...CABLE_ORGANIZER_SEED_PRODUCT,
      id: 'prod-seed',
    })
    setImportNotice(null)
    setAnalysisResult(null)
    setCurrentStep(1)
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

  // Execute AI Product Analysis (Gemini API with Algorithmic Fallback)
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
        body: JSON.stringify({
          ...product,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
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
      setCurrentStep(2)
      setCaption(
        data.suggestedCaption ||
          `${data.strategy.hook} 😅 ${data.analysis.mainBenefit}. Nhỏ mà tiện hơn mình nghĩ nhiều!`
      )
      setHashtags(
        data.suggestedHashtags || [
          '#dogiadung',
          '#giadungthongminh',
          '#organizer',
          '#meovatgiadinh',
          '#reviewgiadung',
        ]
      )
    } catch (err: unknown) {
      alert('Lỗi: ' + (err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Start Step 3: Video Generation Flow (Real FFmpeg + Vietnamese TTS Rendering)
  const handleStartGeneratingVideo = async () => {
    setCurrentStep(3)
    setGenerationProgress({
      stage: '1/4. Khởi tạo & nạp kịch bản Storyboard 15s...',
      percent: 15,
      logs: ['Bắt đầu quy trình sản xuất video TikTok 9:16 thật...'],
    })

    try {
      const formData = new FormData()
      formData.append('productName', product.name)
      if (product.price) formData.append('price', String(product.price))
      if (analysisResult?.storyboard) {
        formData.append('storyboard', JSON.stringify(analysisResult.storyboard))
      }

      // Attach primary image or first available asset
      const primaryAsset = product.assets.find((a) => a.isPrimary) || product.assets[0]
      if (primaryAsset?.file) {
        formData.append('image', primaryAsset.file)
      }

      setGenerationProgress((prev) => ({
        stage: '2/4. Đang tạo giọng đọc thuyết minh tiếng Việt (TTS)...',
        percent: 40,
        logs: [
          ...prev.logs,
          'Gọi dịch vụ TTS tiếng Việt cho 5 phân cảnh Storyboard',
          `Lời thoại cảnh 1: "${analysisResult?.storyboard.scenes[0]?.voice || analysisResult?.strategy.hook}"`,
        ],
      }))

      setGenerationProgress((prev) => ({
        stage: '3/4. Render video 1080x1920 (Hiệu ứng chuyển động & TikTok Overlay)...',
        percent: 70,
        logs: [
          ...prev.logs,
          'Thiết lập khung hình dọc chuẩn TikTok 1080x1920, 30fps',
          'Áp dụng bộ lọc chuyển động Ken Burns & chèn bảng text thông tin',
          'Hòa âm nhạc nền BGM (Audio Ducking khi có lời thoại)',
        ],
      }))

      const res = await fetch('/api/video/render', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Render video thất bại')
      }

      setRenderedVideoUrl(data.videoUrl)

      // Fetch blob to prepare real File object for TikTok publish
      const videoBlobRes = await fetch(data.videoUrl)
      const blob = await videoBlobRes.blob()
      const file = new File([blob], data.fileName || 'product_video.mp4', {
        type: 'video/mp4',
      })
      setRenderedVideoFile(file)

      setGenerationProgress((prev) => ({
        stage: '4/4. Hoàn tất video 15s chuẩn TikTok!',
        percent: 100,
        logs: [
          ...prev.logs,
          `Xuất thành công: ${data.fileName} (${(data.fileSizeBytes / 1024).toFixed(1)} KB)`,
          'Video MP4 sẵn sàng xem trước và đăng trực tiếp lên TikTok!',
        ],
      }))

      setTimeout(() => {
        setCurrentStep(4)
      }, 700)
    } catch (err: unknown) {
      alert('Lỗi render video: ' + (err as Error).message)
      setCurrentStep(2)
    }
  }

  // Publish Directly to TikTok
  const handlePublishToTikTok = async () => {
    setPublishing(true)
    setPublishResult(null)

    try {
      const fullCaption = `${caption} ${hashtags.join(' ')}`
      const formData = new FormData()

      // Prioritize the newly rendered MP4 video
      if (renderedVideoFile) {
        formData.append('video', renderedVideoFile)
      } else if (renderedVideoUrl) {
        const res = await fetch(renderedVideoUrl)
        const blob = await res.blob()
        formData.append('video', new File([blob], 'tiktok_video.mp4', { type: 'video/mp4' }))
      } else {
        const videoAsset = product.assets.find(
          (a) => (a.type === 'PRODUCT_VIDEO' || a.type === 'DEMO_VIDEO') && a.file
        )
        if (videoAsset && videoAsset.file) {
          formData.append('video', videoAsset.file)
        } else {
          alert('Chưa có file video hoàn chỉnh để đăng. Vui lòng quay lại Bước 3 để tạo video trước.')
          setPublishing(false)
          return
        }
      }

      formData.append('title', fullCaption)
      formData.append('privacyLevel', privacyLevel)
      formData.append('disableComment', 'false')
      formData.append('disableDuet', 'false')
      formData.append('disableStitch', 'false')
      formData.append('isAigc', String(isAigc))

      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        setPublishResult({
          success: false,
          message: json.error?.message || 'Đăng video thất bại',
        })
      } else {
        setPublishResult({
          success: true,
          publishId: json.publishId,
          message: 'Video đã được đăng lên TikTok thành công! Đang chờ TikTok xử lý hiển thị.',
        })
      }
    } catch (err: unknown) {
      setPublishResult({
        success: false,
        message: (err as Error)?.message || 'Lỗi kết nối khi đăng video',
      })
    } finally {
      setPublishing(false)
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
            <button
              type="button"
              onClick={() => {
                setTempApiKey(geminiApiKey)
                setShowApiKeyModal(true)
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                geminiApiKey
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              {geminiApiKey ? 'Gemini API Connected' : 'Cài đặt Gemini API Key'}
            </button>

            <Link
              href="/tiktok-test"
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition flex items-center gap-1.5 text-neutral-300"
            >
              <Film className="w-3.5 h-3.5 text-rose-400" />
              TikTok Direct Post Pipeline
            </Link>
          </div>
        </header>

        {/* Gemini API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Cấu hình Google Gemini API</h3>
                    <p className="text-xs text-neutral-400">Dùng để phân tích sản phẩm và tạo kịch bản thật</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300 block">
                  Gemini API Key:
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                />
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Khóa API được lưu an toàn trên trình duyệt. Bạn có thể lấy key miễn phí tại{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-400 hover:underline"
                  >
                    Google AI Studio
                  </a>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeminiApiKey(tempApiKey.trim())
                    localStorage.setItem('gemini_api_key', tempApiKey.trim())
                    setShowApiKeyModal(false)
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  Lưu khóa API
                </button>
              </div>
            </div>
          </div>
        )}

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
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
              currentStep === 1
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                : 'bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            <span className="truncate">1. Nhập sản phẩm</span>
          </button>

          <button
            type="button"
            disabled={!analysisResult}
            onClick={() => setCurrentStep(2)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
              currentStep === 2
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                : analysisResult
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:text-white'
                : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            <span className="truncate">2. AI Phân tích</span>
          </button>

          <button
            type="button"
            disabled={!analysisResult}
            onClick={() => {
              if (analysisResult && currentStep < 3) {
                handleStartGeneratingVideo()
              } else if (currentStep >= 3) {
                setCurrentStep(3)
              }
            }}
            className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
              currentStep === 3
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                : analysisResult
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:text-white'
                : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
            <span className="truncate">3. Đang tạo Video</span>
          </button>

          <button
            type="button"
            disabled={currentStep < 4}
            onClick={() => setCurrentStep(4)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2 transition ${
              currentStep === 4
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
            <span className="truncate">4. Preview &amp; Đăng</span>
          </button>
        </div>

        {/* Step 3: Video Generation Progress */}
        {currentStep === 3 && (
          <div className="p-8 md:p-12 rounded-3xl bg-neutral-900/90 border border-neutral-800 max-w-2xl mx-auto space-y-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center mx-auto text-white shadow-lg shadow-rose-500/30 animate-pulse">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Đang tự động sản xuất Video với Home Engine</h2>
              <p className="text-xs text-neutral-400">{generationProgress.stage}</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-neutral-950 rounded-full h-3 overflow-hidden border border-neutral-800 p-0.5">
                <div
                  className="bg-gradient-to-r from-rose-500 via-pink-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${generationProgress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-neutral-500">
                <span>Rendering 9:16 Video</span>
                <span className="text-rose-400 font-bold">{generationProgress.percent}%</span>
              </div>
            </div>

            {/* Checklist */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-left text-xs space-y-2.5">
              <span className="text-neutral-500 font-semibold block mb-1 font-mono text-[11px]">Quy trình tự động hóa:</span>
              {generationProgress.logs.map((log, idx) => (
                <div key={idx} className="flex items-center gap-2 text-neutral-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Preview & Publish View */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Video đã sản xuất thành công! Sẵn sàng xem trước &amp; Đăng trực tiếp TikTok.</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs"
              >
                Chỉnh sửa kịch bản
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: 9:16 Video Player Preview */}
              <div className="lg:col-span-5 flex flex-col items-center space-y-4">
                <div className="w-full max-w-[340px] aspect-[9/16] rounded-3xl overflow-hidden border-2 border-neutral-800 shadow-2xl bg-black relative flex flex-col justify-between">
                  {renderedVideoUrl ? (
                    <video
                      key={renderedVideoUrl}
                      src={renderedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : product.assets.some((a) => (a.type === 'PRODUCT_VIDEO' || a.type === 'DEMO_VIDEO') && a.url) ? (
                    <video
                      src={product.assets.find((a) => a.type === 'PRODUCT_VIDEO' || a.type === 'DEMO_VIDEO')?.url}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full relative flex flex-col justify-between p-4 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black">
                      <div className="pt-8">
                        <span className="inline-block px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wide shadow-lg">
                          {analysisResult?.strategy.hook || 'Dây sạc cứ rơi xuống sàn?'}
                        </span>
                      </div>

                      <div className="my-auto text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.assets[0]?.url || 'https://images.unsplash.com/photo-1541140532154-b024d705b909?w=800'}
                          alt={product.name}
                          className="w-48 h-48 object-contain mx-auto drop-shadow-2xl rounded-2xl"
                        />
                        <h4 className="font-bold text-white text-sm mt-3">{product.name}</h4>
                        <p className="text-rose-400 font-bold font-mono text-xs">
                          {product.price ? `${typeof product.price === 'number' ? product.price.toLocaleString('vi-VN') : product.price}đ` : 'Giá ưu đãi'}
                        </p>
                      </div>

                      <div className="pb-6 text-center">
                        <p className="text-[11px] bg-black/70 backdrop-blur px-3 py-1.5 rounded-full text-white inline-block border border-white/10">
                          {analysisResult?.storyboard.scenes[0]?.voice || 'Nhà ai dây sạc cứ rơi xuống gầm bàn thì thử miếng này...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {renderedVideoUrl && (
                  <a
                    href={renderedVideoUrl}
                    download="tiktok_product_video.mp4"
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs text-neutral-200 hover:text-white transition flex items-center gap-2 shadow"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    Tải video MP4 về máy (1080x1920)
                  </a>
                )}
              </div>

              {/* Right Column: Publish Settings */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-800 space-y-5">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                    <div>
                      <h3 className="font-bold text-base text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-rose-500" />
                        Đăng trực tiếp lên kênh TikTok (Direct Post)
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Sử dụng TikTok Content Posting API chính thức đã tích hợp.
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono font-bold">
                      Step 4 of 4
                    </span>
                  </div>

                  {/* Caption & Hashtags */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Tiêu đề &amp; Caption TikTok (AI Tự sinh):
                    </label>
                    <textarea
                      rows={3}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-rose-500 leading-relaxed"
                    />
                  </div>

                  {/* Hashtags */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Hashtags xu hướng:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-rose-400 text-xs font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Settings toggles */}
                  <div className="pt-4 border-t border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300">Chế độ hiển thị (Privacy Level):</span>
                      <select
                        value={privacyLevel}
                        onChange={(e) => setPrivacyLevel(e.target.value as 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE')}
                        className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300"
                      >
                        <option value="SELF_ONLY">SELF_ONLY (Bắt buộc khi đang chờ TikTok duyệt)</option>
                        <option value="PUBLIC_TO_EVERYONE">PUBLIC_TO_EVERYONE (Công khai)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300">Gắn nhãn nội dung do AI tạo (is_aigc):</span>
                      <label className="flex items-center gap-2 cursor-pointer text-emerald-400 font-medium">
                        <input
                          type="checkbox"
                          checked={isAigc}
                          onChange={(e) => setIsAigc(e.target.checked)}
                          className="rounded border-neutral-700 text-rose-600 focus:ring-0"
                        />
                        Bật (Tuân thủ chính sách TikTok)
                      </label>
                    </div>
                  </div>

                  {/* Publish Result Feedback */}
                  {publishResult && (
                    <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                      publishResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}>
                      <p className="font-bold flex items-center gap-1.5">
                        {publishResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                        {publishResult.message}
                      </p>
                      {publishResult.publishId && (
                        <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800 space-y-1">
                          <p className="font-mono text-[11px] text-neutral-400">
                            Publish ID: <strong className="text-white">{publishResult.publishId}</strong>
                          </p>
                          <p className="text-[11px] text-amber-300 font-semibold pt-1 border-t border-neutral-900">
                            👉 Bước kế tiếp: Mở app TikTok trên điện thoại → Vào TikTok Shop Creator Center → &quot;Liên kết sản phẩm&quot; để gắn giỏ hàng trong 5 giây!
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Publish Action Button */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartGeneratingVideo()}
                      className="py-3 px-4 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                    >
                      Tạo lại Video
                    </button>

                    <button
                      type="button"
                      onClick={handlePublishToTikTok}
                      disabled={publishing}
                      className="flex-1 py-3.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {publishing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Đang tải lên TikTok qua Content Posting API...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          ĐĂNG LÊN TIKTOK NGAY (PUBLISH TO TIKTOK)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1 & 2: Main Workspace Grid */}
        {(currentStep === 1 || currentStep === 2) && (
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      inputMode === 'manual'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>✍️ Nhập thông tin (Affiliate cá nhân)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white font-mono font-normal">
                      Khuyên dùng
                    </span>
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
                    <span>Dán link Shop (Cần Partner API)</span>
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-300 block">
                      Đường dẫn sản phẩm TikTok Shop (Product URL):
                    </label>
                    <span className="text-[11px] text-amber-400/90 font-mono">
                      Yêu cầu tài khoản TikTok Shop Partner
                    </span>
                  </div>
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
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {importingUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      IMPORT PRODUCT
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400">
                    💡 <em>Lưu ý:</em> TikTok bảo vệ dữ liệu sản phẩm và chỉ cấp quyền đọc link cho công ty đăng ký TikTok Shop Partner Center. Nếu bạn là Creator Affiliate cá nhân, hãy bấm <strong>Nhập thông tin</strong> ở trên để tự điền tên &amp; ảnh trong 15 giây.
                  </p>

                  {importNotice && (
                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{importNotice.message}</p>
                      </div>
                      <div className="pt-2 border-t border-amber-500/20 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInputMode('manual')}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition"
                        >
                          Chuyển sang Nhập thông tin &amp; Tải ảnh →
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadSeed}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white text-xs transition"
                        >
                          Nạp mẫu Demo nhanh
                        </button>
                      </div>
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Home &amp; Utility Engine Strategy
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold font-mono">
                        {analysisResult.strategy.format.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={handleStartGeneratingVideo}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-neutral-950 shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 fill-current" />
                        Tạo Video (Bước 3) →
                      </button>
                    </div>
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
                    <span className="font-mono text-[11px]">Home Engine Ready</span>
                  </div>

                  {/* PROMINENT BUTTON TO GO TO STEP 3 */}
                  <button
                    type="button"
                    onClick={handleStartGeneratingVideo}
                    className="w-full py-4 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 transform hover:scale-[1.01]"
                  >
                    <Sparkles className="w-4 h-4 fill-current" />
                    TIẾN HÀNH TẠO VIDEO (GENERATE VIDEO) → BƯỚC 3
                    <ArrowRight className="w-4 h-4" />
                  </button>
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
        )}
      </div>
    </div>
  )
}
