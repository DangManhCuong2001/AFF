'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
  ShoppingBag,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Wand2,
  RotateCcw,
  Check,
  ShieldCheck,
  Flame,
  Award,
  ExternalLink,
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
import { CreativePlan, HookCandidate, StoryApproach } from '@/engines/creative/types'
import { VoicePersonality } from '@/engines/speech/types'
import { InfographicDeckViewer } from '@/components/infographic/InfographicDeckViewer'
import { CABLE_ORGANIZER_SEED_PRODUCT } from '@/engines/home/seed'
import { RemotionPlayerPreview } from '@/components/video/RemotionPlayerPreview'

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
    creativePlan?: CreativePlan
  } | null>(null)

  // Creative Director Engine State
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<VoicePersonality>('Natural Friend')
  const [selectedHookId, setSelectedHookId] = useState<string>('')
  const [selectedApproach, setSelectedApproach] = useState<StoryApproach>('micro-story')
  const [isVoicePlaying, setIsVoicePlaying] = useState(false)
  const [isVoiceLoading, setIsVoiceLoading] = useState(false)
  const [isRegeneratingAngle, setIsRegeneratingAngle] = useState(false)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null)

  // Full Storyboard Vietnamese Voiceover audio state
  const [storyboardVoiceUrl, setStoryboardVoiceUrl] = useState<string | null>(null)
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false)

  // Video duration state (15s, 30s, 45s)
  const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 45>(15)

  // Strict 3-step linear flow: 1: Nhập thông tin & Thời lượng | 2: Phân tích & Kế hoạch | 3: Tạo Layout & Video Studio
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [isRenderingVideo, setIsRenderingVideo] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{
    stage: string
    percent: number
    logs: string[]
  }>({
    stage: 'idle',
    percent: 0,
    logs: [],
  })
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

  // TikTok Connection State
  const [tiktokConnected, setTiktokConnected] = useState<boolean | null>(null)

  React.useEffect(() => {
    fetch('/api/tiktok/status')
      .then((r) => r.json())
      .then((data) => setTiktokConnected(!!data.connected && !data.expired))
      .catch(() => setTiktokConnected(false))
  }, [])

  // Rendered video state
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null)
  const [renderedVideoFile, setRenderedVideoFile] = useState<File | null>(null)

  // Automatically generate full Vietnamese voiceover for Storyboard scenes
  useEffect(() => {
    const scenes = analysisResult?.storyboard?.scenes
    if (!scenes || scenes.length === 0) return

    let isSubscribed = true
    const fetchStoryboardVoice = async () => {
      try {
        setIsGeneratingVoice(true)
        const res = await fetch('/api/audio/storyboard-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenes,
            voicePreset: selectedVoicePreset,
          }),
        })
        if (!res.ok) throw new Error('Không thể tải giọng đọc')
        const blob = await res.blob()
        if (isSubscribed) {
          const url = URL.createObjectURL(blob)
          setStoryboardVoiceUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        }
      } catch (err) {
        console.warn('[AutoVoice] Failed to synthesize storyboard audio:', err)
      } finally {
        if (isSubscribed) setIsGeneratingVoice(false)
      }
    }

    fetchStoryboardVoice()

    return () => {
      isSubscribed = false
    }
  }, [analysisResult?.storyboard?.scenes, selectedVoicePreset])

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

      if (data.success && data.product) {
        const isBotName = data.product.name?.toLowerCase().includes('security check')
        const safeName = isBotName ? '' : data.product.name

        setProduct((prev) => ({
          ...prev,
          name: safeName || prev.name,
          price: data.product.price ? String(data.product.price) : prev.price,
          description: data.product.description || prev.description,
          productUrl: data.product.productUrl || prev.productUrl,
          shopProductId: data.product.shopProductId || prev.shopProductId,
          assets:
            data.product.assets && data.product.assets.length > 0
              ? data.product.assets
              : prev.assets,
        }))
        const hasPrice = Boolean(data.product.price)
        setImportNotice({
          message: data.message || (hasPrice
            ? 'Đã trích xuất thông tin sản phẩm thành công!'
            : 'Đã trích xuất Tên và Bộ ảnh từ link. Bạn nhớ nhập Giá sản phẩm ở ô bên dưới nhé!'),
          requiresFallback: !hasPrice,
        })
      } else if (data.requiresManualFallback) {
        setImportNotice({
          message: data.message,
          requiresFallback: true,
        })
        setProduct((prev) => ({
          ...prev,
          name:
            data.product?.name && !data.product.name.toLowerCase().includes('security check')
              ? data.product.name
              : prev.name,
          productUrl: data.product?.productUrl || prev.productUrl,
          shopProductId: data.product?.shopProductId || prev.shopProductId,
        }))
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

  // Support pasting images from clipboard (Ctrl+V / Cmd+V) directly into product assets
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter((f) =>
          f.type.startsWith('image/')
        )
        if (imageFiles.length > 0) {
          if (!isInput) {
            e.preventDefault()
          }
          const newAssets: ProductAsset[] = imageFiles.map((file, idx) => ({
            id: 'asset-paste-' + Date.now() + '-' + idx,
            name: `Ảnh dán clipboard (${file.name || 'Pasted'}).png`,
            size: file.size,
            type: 'DETAIL_IMAGE',
            url: URL.createObjectURL(file),
            file,
            isPrimary: false,
          }))

          setProduct((prev) => ({
            ...prev,
            assets: [...prev.assets, ...newAssets],
          }))
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

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
          targetDuration: selectedDuration,
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
        creativePlan: data.creativePlan,
      })
      if (data.creativePlan?.selectedHook?.id) {
        setSelectedHookId(data.creativePlan.selectedHook.id)
      }
      if (data.creativePlan?.storyType) {
        setSelectedApproach(data.creativePlan.storyType)
      }
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

  // Switch to another Hook candidate among the 5 generated hooks
  const handleSelectHook = (candidate: HookCandidate) => {
    setSelectedHookId(candidate.id)
    if (!analysisResult) return

    setAnalysisResult((prev) => {
      if (!prev) return prev
      const updatedScenes = [...prev.storyboard.scenes]
      if (updatedScenes.length > 0) {
        updatedScenes[0] = {
          ...updatedScenes[0],
          voice: candidate.text,
          headline: candidate.text,
        }
      }
      return {
        ...prev,
        strategy: {
          ...prev.strategy,
          hook: candidate.text,
        },
        storyboard: {
          ...prev.storyboard,
          scenes: updatedScenes,
        },
        creativePlan: prev.creativePlan
          ? {
              ...prev.creativePlan,
              selectedHook: candidate,
              hook: candidate.text,
            }
          : undefined,
      }
    })

    setCaption(`${candidate.text} 😅 ${analysisResult.analysis.mainBenefit}. Nhỏ mà tiện hơn mình nghĩ nhiều!`)
  }

  // Story approach rotation list
  const STORY_APPROACH_ROTATION: StoryApproach[] = [
    'micro-story',
    'daily-frustration',
    'relatable-moment',
    'curiosity-test',
    'before-after',
    'mini-review',
    'pov',
    'three-reasons',
    'satisfying',
  ]

  // Generate another angle / story approach
  const handleGenerateAnotherAngle = async () => {
    if (!product.name.trim()) return
    setIsRegeneratingAngle(true)

    try {
      const currentIndex = STORY_APPROACH_ROTATION.indexOf(selectedApproach)
      const nextApproach = STORY_APPROACH_ROTATION[(currentIndex + 1) % STORY_APPROACH_ROTATION.length]
      setSelectedApproach(nextApproach)

      const res = await fetch('/api/creative/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          targetDuration: selectedDuration,
          approach: nextApproach,
          voicePreset: selectedVoicePreset,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Đổi góc tiếp cận thất bại')
        return
      }

      if (data.creativePlan) {
        const plan: CreativePlan = data.creativePlan
        setSelectedHookId(plan.selectedHook.id)

        setAnalysisResult((prev) => {
          if (!prev) return prev
          const newScenes = prev.storyboard.scenes.map((sc, i) => {
            if (plan.spokenScenes && plan.spokenScenes[i]) {
              const sp = plan.spokenScenes[i]
              return {
                ...sc,
                voice: sp.voice,
                headline: sp.headline,
                keywords: sp.keywords || sc.keywords,
              }
            }
            if (i === 0) return { ...sc, voice: plan.selectedHook.text, headline: plan.selectedHook.text }
            if (i === 1) return { ...sc, voice: 'Bình thường mỗi lần gặp phiền toái như này vừa mất thời gian vừa bực mình ghê!', headline: 'Vấn đề khó chịu' }
            if (i === 2) return { ...sc, voice: `May mà mình tậu được ${product.name} này, nhỏ xíu mà tiện dã man luôn á!`, headline: 'Giải pháp cứu tinh' }
            if (i === 3) return { ...sc, voice: 'Dùng một cái là ưng cái bụng liền, gọn gàng 10 điểm không có nhưng luôn!', headline: 'Trải nghiệm 10/10' }
            if (i === 4) return { ...sc, voice: plan.cta || 'Bấm ngay giỏ hàng góc trái bên dưới để săn deal ưu đãi nhé!', headline: 'Giỏ hàng góc trái' }
            return sc
          })

          return {
            ...prev,
            creativePlan: plan,
            strategy: {
              ...prev.strategy,
              hook: plan.selectedHook.text,
            },
            storyboard: {
              ...prev.storyboard,
              scenes: newScenes,
            },
          }
        })

        setCaption(`${plan.selectedHook.text} 😅 ${product.problemSolved || 'Gọn gàng tức thì'}. Xem ở giỏ hàng nhé!`)
      }
    } catch (e: unknown) {
      alert('Lỗi: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setIsRegeneratingAngle(false)
    }
  }

  // Voice Preview player with Audio Blob fetching for universal browser compatibility
  const handlePreviewVoice = async (textToPlay?: string) => {
    if (isVoicePlaying || isVoiceLoading) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      setIsVoicePlaying(false)
      setIsVoiceLoading(false)
      return
    }

    const text =
      textToPlay ||
      analysisResult?.creativePlan?.selectedHook?.text ||
      analysisResult?.strategy.hook ||
      analysisResult?.storyboard.scenes[0]?.voice ||
      'Chào bạn, đây là bản xem trước giọng đọc thuyết minh tiếng Việt tự nhiên.'

    setIsVoiceLoading(true)

    try {
      const audioUrl = `/api/audio/tts?text=${encodeURIComponent(text)}&preset=${encodeURIComponent(selectedVoicePreset)}`
      const res = await fetch(audioUrl)
      if (!res.ok) throw new Error('Không thể tải giọng đọc')

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      setVoicePreviewUrl(objectUrl)
      const audio = new Audio(objectUrl)
      previewAudioRef.current = audio

      audio.onended = () => {
        setIsVoicePlaying(false)
        setIsVoiceLoading(false)
        previewAudioRef.current = null
        URL.revokeObjectURL(objectUrl)
      }

      audio.onerror = () => {
        setIsVoicePlaying(false)
        setIsVoiceLoading(false)
        previewAudioRef.current = null
        URL.revokeObjectURL(objectUrl)
      }

      await audio.play()
      setIsVoiceLoading(false)
      setIsVoicePlaying(true)
    } catch (e) {
      console.warn('[handlePreviewVoice] Error:', e)
      setIsVoiceLoading(false)
      setIsVoicePlaying(false)
      if (previewAudioRef.current) {
        previewAudioRef.current = null
      }
    }
  }

  // Start Step 3: Video Generation Flow (Real FFmpeg + Vietnamese TTS Rendering)
  const handleStartGeneratingVideo = async () => {
    setIsRenderingVideo(true)
    setGenerationProgress({
      stage: `1/4. Khởi tạo & nạp kịch bản Storyboard ${selectedDuration}s...`,
      percent: 15,
      logs: ['Bắt đầu quy trình sản xuất video TikTok 9:16 thật...'],
    })

    try {
      const formData = new FormData()
      formData.append('productName', product.name)
      if (product.price) formData.append('price', String(product.price))
      if (product.category) formData.append('category', product.category)
      formData.append('voicePreset', selectedVoicePreset)
      if (analysisResult?.storyboard) {
        formData.append('storyboard', JSON.stringify(analysisResult.storyboard))
      }

      // Attach all gallery images: both uploaded files and external URLs
      const imageFiles = product.assets
        .filter((a) => (a.type === 'PRODUCT_IMAGE' || a.type === 'DETAIL_IMAGE') && a.file)
        .map((a) => a.file!)

      for (const f of imageFiles) {
        formData.append('images', f)
      }

      const imageUrls = product.assets
        .filter((a) => (a.type === 'PRODUCT_IMAGE' || a.type === 'DETAIL_IMAGE') && a.url && !a.file)
        .map((a) => a.url)

      if (imageUrls.length > 0) {
        formData.append('imageUrls', JSON.stringify(imageUrls))
      }

      // Single image fallback
      const primaryAsset = product.assets.find((a) => a.isPrimary) || product.assets[0]
      if (primaryAsset?.file) {
        formData.append('image', primaryAsset.file)
      }

      // Attach pre-generated audio track if already synthesized in Preview
      const activeVoiceUrl = storyboardVoiceUrl || voicePreviewUrl
      if (activeVoiceUrl) {
        try {
          const audioRes = await fetch(activeVoiceUrl)
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob()
            if (audioBlob.size > 100) {
              formData.append('audio', audioBlob, 'master_voice.mp3')
              console.log('[handleStartGeneratingVideo] Attached pre-synthesized audio blob:', audioBlob.size, 'bytes')
            }
          }
        } catch (audioFetchErr) {
          console.warn('[handleStartGeneratingVideo] Could not attach preview audio:', audioFetchErr)
        }
      }

      setGenerationProgress((prev) => ({
        stage: '2/4. Đang tạo giọng đọc thuyết minh tiếng Việt (TTS)...',
        percent: 40,
        logs: [
          ...prev.logs,
          `Đồng bộ giọng đọc thuyết minh cho ${analysisResult?.storyboard.scenes.length || 5} phân cảnh Storyboard (${analysisResult?.strategy.targetDuration || selectedDuration}s)`,
          `Lời thoại cảnh 1: "${analysisResult?.storyboard.scenes[0]?.voice || analysisResult?.strategy.hook}"`,
        ],
      }))

      setGenerationProgress((prev) => ({
        stage: '3/4. Render Remotion Studio 1080x1920 (Khớp 100% với Preview)...',
        percent: 70,
        logs: [
          ...prev.logs,
          'Dựng video bằng Remotion Engine: Đảm bảo đồ họa, typography và hoạt ảnh trùng khớp hoàn toàn với Preview',
          'Tích hợp đầy đủ giọng đọc tiếng Việt, nhạc nền BGM và hiệu ứng âm thanh SFX',
        ],
      }))

      const res = await fetch('/api/video/render', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errMsg = `Render video thất bại (${res.status})`
        try {
          const text = await res.text()
          try {
            const errData = JSON.parse(text)
            errMsg = errData.error || errData.message || errMsg
          } catch {
            if (text && text.trim()) {
              errMsg = text.slice(0, 250)
            }
          }
        } catch {
          // ignore stream read error
        }
        throw new Error(errMsg)
      }

      const contentType = res.headers.get('content-type') || ''
      let videoBlobUrl = ''
      let file: File
      let fileName = `product_video_${Date.now()}.mp4`
      let fileSizeBytes = 0

      if (contentType.includes('application/json')) {
        const data = await res.json()
        fileName = data.fileName || fileName
        fileSizeBytes = data.fileSizeBytes || 0
        videoBlobUrl = data.videoUrl
        const videoBlobRes = await fetch(data.videoUrl)
        const blob = await videoBlobRes.blob()
        file = new File([blob], fileName, { type: 'video/mp4' })
      } else {
        // Direct MP4 binary response (instant playback, 100% resilient across serverless Lambda instances)
        const blob = await res.blob()
        videoBlobUrl = URL.createObjectURL(blob)
        fileName = res.headers.get('X-Video-Filename') || fileName
        fileSizeBytes = Number(res.headers.get('X-Video-Filesize')) || blob.size
        file = new File([blob], fileName, { type: 'video/mp4' })
      }

      setRenderedVideoUrl(videoBlobUrl)
      setRenderedVideoFile(file)

      setGenerationProgress((prev) => ({
        stage: `4/4. Hoàn tất video ${selectedDuration}s chuẩn TikTok!`,
        percent: 100,
        logs: [
          ...prev.logs,
          `Xuất thành công: ${fileName} (${(fileSizeBytes / 1024).toFixed(1)} KB)`,
          'Video MP4 sẵn sàng xem trước và đăng trực tiếp lên TikTok!',
        ],
      }))
    } catch (err: unknown) {
      alert('Lỗi render video: ' + (err as Error).message)
    } finally {
      setIsRenderingVideo(false)
    }
  }

  // Publish Directly to TikTok with chunked upload support (bypasses Vercel 4.5MB limit)
  const handlePublishToTikTok = async () => {
    setPublishing(true)
    setPublishResult(null)

    try {
      const fullCaption = `${caption} ${hashtags.join(' ')}`

      // 1. Resolve video file
      let videoFile: File | null = null
      if (renderedVideoFile) {
        videoFile = renderedVideoFile
      } else if (renderedVideoUrl) {
        const res = await fetch(renderedVideoUrl)
        const blob = await res.blob()
        videoFile = new File([blob], 'tiktok_video.mp4', { type: 'video/mp4' })
      } else {
        const videoAsset = product.assets.find(
          (a) => (a.type === 'PRODUCT_VIDEO' || a.type === 'DEMO_VIDEO') && a.file
        )
        if (videoAsset && videoAsset.file) {
          videoFile = videoAsset.file
        } else {
          alert('Chưa có file video hoàn chỉnh để đăng. Vui lòng quay lại Bước 3 để tạo video trước.')
          setPublishing(false)
          return
        }
      }

      if (!videoFile || videoFile.size <= 0) {
        throw new Error('File video không hợp lệ hoặc rỗng.')
      }

      // 2. Step 1: Initialize post with lightweight JSON (payload < 1KB, completely avoids 413)
      const initRes = await fetch('/api/tiktok/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fullCaption,
          privacyLevel,
          videoSize: videoFile.size,
          disableComment: false,
          disableDuet: false,
          disableStitch: false,
          isAigc,
        }),
      })

      const initJson = await initRes.json().catch(() => ({}))
      if (!initRes.ok || !initJson.uploadUrl || !initJson.publishId) {
        throw new Error(initJson.error?.message || `Khởi tạo đăng video thất bại (${initRes.status})`)
      }

      const { publishId, uploadUrl } = initJson

      // 3. Step 2: Upload Video Bytes
      // Try Direct Upload to TikTok's upload_url first
      let uploadSuccess = false
      try {
        const directRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoFile.size),
            'Content-Range': `bytes 0-${videoFile.size - 1}/${videoFile.size}`,
          },
          body: videoFile,
        })
        if (directRes.ok) {
          uploadSuccess = true
        }
      } catch (directErr) {
        console.warn('Direct upload to TikTok storage failed, using resilient chunk proxy:', directErr)
      }

      // If direct upload failed (e.g. CORS), upload through Serverless Chunk Proxy (2MB chunks < 4.5MB limit)
      if (!uploadSuccess) {
        const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB chunk
        for (let start = 0; start < videoFile.size; start += CHUNK_SIZE) {
          const end = Math.min(start + CHUNK_SIZE, videoFile.size)
          const chunkBlob = videoFile.slice(start, end)
          const chunkForm = new FormData()
          chunkForm.append('action', 'chunk')
          chunkForm.append('uploadUrl', uploadUrl)
          chunkForm.append('startByte', String(start))
          chunkForm.append('totalBytes', String(videoFile.size))
          chunkForm.append('chunk', chunkBlob)

          const chunkRes = await fetch('/api/tiktok/publish', {
            method: 'POST',
            body: chunkForm,
          })
          if (!chunkRes.ok) {
            const chunkErr = await chunkRes.json().catch(() => ({}))
            throw new Error(chunkErr.error?.message || `Lỗi tải phân đoạn video (${chunkRes.status})`)
          }
        }
      }

      setPublishResult({
        success: true,
        publishId,
        message: 'Video đã được đăng lên TikTok thành công! Đang chờ TikTok xử lý hiển thị.',
      })
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
              <Link href="/" className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg shadow-rose-500/20 shrink-0">
                <Image
                  src="/vipee-icon-512.png"
                  alt="Vipee Logo"
                  width={44}
                  height={44}
                  priority
                  className="object-cover"
                />
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Vipee Studio
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

            <a
              href="/api/tiktok/auth"
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                tiktokConnected
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:bg-rose-900/40 hover:border-rose-500/50'
              }`}
              title={tiktokConnected ? 'TikTok đã kết nối - Bấm để kết nối lại' : 'Bấm để kết nối tài khoản TikTok'}
            >
              <Film className="w-3.5 h-3.5 text-rose-400" />
              {tiktokConnected ? 'TikTok Connected' : 'Kết nối TikTok'}
            </a>

            <Link
              href="/integrations"
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition flex items-center gap-1.5 text-neutral-300"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              Integrations
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
        {/* Step Indicator - Strict 3-Step Sequential Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
              currentStep === 1
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold ring-1 ring-rose-500/30'
                : 'bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            <span className="truncate">1. Nhập sản phẩm &amp; Thời lượng</span>
          </button>

          <button
            type="button"
            disabled={!analysisResult}
            onClick={() => setCurrentStep(2)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
              currentStep === 2
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold ring-1 ring-rose-500/30 cursor-pointer'
                : analysisResult
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:text-white cursor-pointer'
                : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            <span className="truncate">2. Phân tích &amp; Lập kế hoạch</span>
          </button>

          <button
            type="button"
            disabled={!analysisResult}
            onClick={() => setCurrentStep(3)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
              currentStep === 3
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-semibold ring-1 ring-amber-500/30 cursor-pointer'
                : analysisResult
                ? 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:text-white cursor-pointer'
                : 'bg-neutral-900/20 border-neutral-800/40 text-neutral-600 cursor-not-allowed'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
            <span className="truncate">3. Tạo Layout &amp; Video Studio</span>
          </button>
        </div>

        {/* Guard: If user clicks step 2 or 3 without analysis result */}
        {currentStep !== 1 && !analysisResult && (
          <div className="p-12 rounded-3xl bg-neutral-900/90 border border-neutral-800 text-center space-y-4 max-w-lg mx-auto">
            <Sparkles className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-white">Chưa có thông tin phân tích sản phẩm</h3>
            <p className="text-xs text-neutral-400">
              Vui lòng quay lại Bước 1 để nhập thông tin sản phẩm và phân tích kịch bản video trước.
            </p>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer"
            >
              ← Quay lại Bước 1 (Nhập sản phẩm)
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: NHẬP SẢN PHẨM HOẶC LINK & CHỌN THỜI LƯỢNG */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto space-y-6">
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
                    <span>Dán link TikTok Shop (Tự động lấy thông tin)</span>
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
                    <span className="text-[11px] text-emerald-400/90 font-mono">
                      Hỗ trợ vt.tiktok.com &amp; shop.tiktok.com
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={tiktokUrl}
                      onChange={(e) => setTiktokUrl(e.target.value)}
                      placeholder="Dán link sản phẩm TikTok Shop hoặc link từ Zalo..."
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleImportUrl}
                      disabled={importingUrl}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {importingUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      LẤY THÔNG TIN SẢN PHẨM
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    💡 Hỗ trợ link rút gọn <code>vt.tiktok.com</code>, link <code>shop.tiktok.com</code> hoặc link chuyển tiếp từ Zalo. Hệ thống sẽ tự động quét Tên, Giá, Ảnh gốc và Mô tả sản phẩm!
                  </p>

                  {importNotice && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                        importNotice.requiresFallback
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                          : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {importNotice.requiresFallback ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        <p className="leading-relaxed font-medium">{importNotice.message}</p>
                      </div>
                      {importNotice.requiresFallback && (
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
                      )}
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
                    <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
                      <span>Giá tham khảo (VND)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Tự động ẩn trên video</span>
                    </label>
                    <input
                      type="text"
                      value={product.price || ''}
                      onChange={(e) => setProduct({ ...product, price: e.target.value })}
                      placeholder="VD: 155000"
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
                    Nguyên tắc Real Product First: AI sử dụng hình ảnh thật của sản phẩm để dựng video chân thực.
                    <span className="block sm:inline sm:ml-1.5 text-rose-400 font-medium">
                      💡 Mẹo: Nhấn Ctrl+V / Cmd+V bất kỳ lúc nào để dán nhanh ảnh chụp màn hình từ clipboard!
                    </span>
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

            {/* Video Duration Selector (15s, 30s, 45s) */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Chọn độ dài video TikTok
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Đang chọn: <span className="text-amber-400 font-bold">{selectedDuration}s</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 15s Option */}
                <button
                  type="button"
                  onClick={() => setSelectedDuration(15)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedDuration === 15
                      ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500/30'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">15 Giây</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold font-mono">
                      5 cảnh
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Hook nhanh, giữ chân cao, thuật toán TikTok đề xuất mạnh nhất.
                  </p>
                </button>

                {/* 30s Option */}
                <button
                  type="button"
                  onClick={() => setSelectedDuration(30)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedDuration === 30
                      ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500/30'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">30 Giây</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold font-mono">
                      6 cảnh
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Review chi tiết, đi sâu tính năng, giải quyết vấn đề trọn vẹn.
                  </p>
                </button>

                {/* 45s Option */}
                <button
                  type="button"
                  onClick={() => setSelectedDuration(45)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedDuration === 45
                      ? 'border-rose-500 bg-rose-500/10 text-white ring-1 ring-rose-500/30'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">45 Giây</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold font-mono">
                      9 cảnh
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Chuyên sâu, so sánh chi tiết, dẫn chứng đánh giá thuyết phục cao.
                  </p>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Video không in trực tiếp số tiền để tránh lệch giá và kích thích bấm vào giỏ hàng góc trái.</span>
              </div>
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
                  TIẾP TỤC: PHÂN TÍCH &amp; LẬP KẾ HOẠCH VIDEO ({selectedDuration}s)
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: PHÂN TÍCH & LẬP KẾ HOẠCH VIDEO */}
        {/* ======================================================== */}
        {currentStep === 2 && analysisResult && (
          <div className="space-y-6">
            {/* Top Bar Navigation for Step 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                ← Quay lại Bước 1 (Sửa thông tin sản phẩm / Đổi thời lượng)
              </button>
              <div className="text-right">
                <span className="text-xs text-neutral-400">Thời lượng kịch bản:</span>{' '}
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {selectedDuration}s • {analysisResult.storyboard.scenes.length} phân cảnh
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: VIPEE CREATIVE DIRECTOR (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                {/* 1. Creative Director Main Card */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-rose-500/40 space-y-5 shadow-2xl backdrop-blur">
                  {/* Top Bar: Title + Change Angle Button */}
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                          VIPEE CREATIVE DIRECTOR
                        </h3>
                        <p className="text-[10px] text-rose-400 font-mono">
                          Direct-Response Story Engine • UGC TikTok
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAnotherAngle}
                      disabled={isRegeneratingAngle}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Chuyển sang góc tiếp cận kịch bản khác (POV, Daily Frustration, Skeptical Test...)"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRegeneratingAngle ? 'animate-spin' : ''}`} />
                      <span>{isRegeneratingAngle ? 'Đang đổi...' : 'Đổi góc kể chuyện'}</span>
                    </button>
                  </div>

                  {/* Concept & Audience Insight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
                        💡 Creative Concept:
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold uppercase">
                        {analysisResult.creativePlan?.storyType || selectedApproach}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/90">
                      <p className="text-xs font-semibold text-white leading-snug">
                        &quot;{analysisResult.creativePlan?.concept || 'The tiny annoyance you tolerate every day'}&quot;
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                        👀 <strong className="text-neutral-300">Tâm lý người xem:</strong> {analysisResult.creativePlan?.viewerInsight || analysisResult.analysis.mainProblem}
                      </p>
                    </div>
                  </div>

                  {/* Emotional Arc */}
                  {analysisResult.creativePlan?.emotionalArc && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                        Đường cong cảm xúc (Emotional Arc):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisResult.creativePlan.emotionalArc.map((arc, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-amber-300/90 font-mono"
                          >
                            {i + 1}. {arc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. HOOK ENGINE: 5 Ranked Hook Candidates */}
                  <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        Hook Engine: 5 Đề xuất giữ chân 3s đầu
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Chọn hook bạn thích nhất
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(analysisResult.creativePlan?.hookCandidates || [
                        {
                          id: 'hook-1',
                          text: analysisResult.strategy.hook,
                          type: 'curiosity' as const,
                          scores: {
                            curiosity: 92,
                            relatability: 90,
                            specificity: 88,
                            visualPotential: 90,
                            clarity: 90,
                            total: 92,
                          },
                          reasoning: 'Gợi mở sự tò mò và cảm giác thân quen',
                        },
                      ]).map((candidate) => {
                        const scoreVal = candidate.scores?.total || 90
                        const isSelected = selectedHookId === candidate.id || (!selectedHookId && scoreVal >= 90)
                        return (
                          <div
                            key={candidate.id}
                            onClick={() => handleSelectHook(candidate as HookCandidate)}
                            className={`p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col gap-1.5 ${
                              isSelected
                                ? 'bg-rose-950/30 border-rose-500 shadow-md shadow-rose-950/50'
                                : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-rose-400 font-bold uppercase">
                                {candidate.type}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-amber-400">
                                  {scoreVal}/100đ
                                </span>
                                {isSelected && (
                                  <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white">
                                    <Check className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className={`text-xs leading-relaxed ${isSelected ? 'font-bold text-white' : 'text-neutral-300'}`}>
                              &quot;{candidate.text}&quot;
                            </p>
                            {candidate.reasoning && (
                              <p className="text-[10px] text-neutral-500 italic">
                                💡 {candidate.reasoning}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3. Creative Quality Score */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" />
                        Creative Score (Đánh giá chất lượng)
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        {analysisResult.creativePlan?.creativeScore?.overallQuality || 88}/100 • ĐẠT TIÊU CHUẨN ✅
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                        <p className="text-[10px] text-neutral-400">Hook &amp; Tò mò</p>
                        <p className="text-xs font-bold text-white font-mono mt-0.5">
                          {analysisResult.creativePlan?.creativeScore?.hookScore || 92}%
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                        <p className="text-[10px] text-neutral-400">Độ đồng cảm</p>
                        <p className="text-xs font-bold text-white font-mono mt-0.5">
                          {analysisResult.creativePlan?.creativeScore?.relatabilityScore || 88}%
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                        <p className="text-[10px] text-neutral-400">Story &amp; Payoff</p>
                        <p className="text-xs font-bold text-white font-mono mt-0.5">
                          {analysisResult.creativePlan?.creativeScore?.storyScore || 89}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Human Voice Director & Preset Selector */}
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                        Human Voice Director (Giọng thuyết minh)
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePreviewVoice()}
                        disabled={isVoiceLoading}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-60"
                      >
                        {isVoiceLoading ? (
                          <>
                            <RefreshCw className="w-3 h-3 text-rose-400 animate-spin" />
                            <span>Đang tạo giọng...</span>
                          </>
                        ) : isVoicePlaying ? (
                          <>
                            <VolumeX className="w-3 h-3 text-rose-400" />
                            <span>Dừng nghe</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 text-rose-400" />
                            <span>Nghe thử Voice</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'Natural Friend', label: '🌿 Bạn bè tự nhiên' },
                        { id: 'Warm Reviewer', label: '☕ Review ấm áp' },
                        { id: 'Curious Tester', label: '🔍 Tò mò trải nghiệm' },
                        { id: 'Energetic Seller', label: '⚡ Năng động sôi nổi' },
                        { id: 'Calm Explainer', label: '🧘 Điềm tĩnh gãy gọn' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedVoicePreset(preset.id as VoicePersonality)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border text-left transition ${
                            selectedVoicePreset === preset.id
                              ? 'bg-rose-600/20 border-rose-500 text-white font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      💡 Tự động chèn micro-pause 300ms giữa các câu nói, đọc chuẩn phiên âm tên sản phẩm (không đọc như robot).
                    </p>
                  </div>

                  {/* 5. Authentic OfferEngine Guard */}
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-300 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      OfferEngine &amp; CTA Tự nhiên:
                    </div>
                    <p className="italic text-white">
                      &quot;{analysisResult.creativePlan?.cta || 'Nếu bàn làm việc của bạn cũng hay bị như thế này thì mình để sản phẩm ở giỏ hàng góc trái nhé.'}&quot;
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      ✅ Cam kết: Không gán sale ảo, không tạo khan hiếm giả tạo. Chỉ dùng giá thật hoặc dẫn dắt tự nhiên từ kết quả câu chuyện.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Storyboard Timeline (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-neutral-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-rose-400" />
                      Storyboard Phân Cảnh (Audio-First Sync)
                    </h3>
                    <span className="text-xs text-neutral-500 font-mono">
                      {analysisResult.storyboard.scenes.length} Scenes • {selectedDuration}s
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
                          🗣️ Lời thoại: &quot;{scene.voice}&quot;
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <span>Trạng thái: <strong>Kịch bản sáng tạo hoàn chỉnh</strong></span>
                    <span className="font-mono text-[11px]">Vipee Engine Ready</span>
                  </div>

                  {/* PROMINENT BUTTON TO GO TO STEP 3 */}
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="w-full py-4 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-neutral-950 shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 transform hover:scale-[1.01] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 fill-current" />
                    TIẾP TỤC: TẠO LAYOUT &amp; VIDEO STUDIO ({analysisResult.storyboard.scenes.length} Phân Cảnh) ➔
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: TẠO LAYOUT & VIDEO STUDIO (ĐỒNG BỘ N CẢNH) */}
        {/* ======================================================== */}
        {currentStep === 3 && analysisResult && (
          <div className="space-y-8">
            {/* Part 1: Infographic Layout Deck ({N} Layouts matching {N} scenes) */}
            <InfographicDeckViewer
              productName={product.name || 'Sản phẩm tiện ích'}
              price={product.price}
              primaryImageUrl={
                product.assets.find((a) => a.isPrimary)?.url ||
                product.assets[0]?.url ||
                ''
              }
              secondaryImageUrl={product.assets[1]?.url}
              galleryImages={product.assets.map((a) => a.url)}
              scenes={analysisResult.storyboard.scenes}
              duration={selectedDuration}
            />

            {/* Part 2: Video Studio (Remotion Player Preview 60fps & MP4 Render / Publish) */}
            <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Film className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">Video Studio TikTok (Xem trước 60fps &amp; Xuất MP4)</h3>
                    <p className="text-xs text-neutral-400">
                      Đồng bộ hoàn hảo giữa {analysisResult.storyboard.scenes.length} layout thương mại, hình ảnh sản phẩm và thuyết minh tiếng Việt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Remotion Player 9:16 */}
                <div className="lg:col-span-5 flex flex-col items-center space-y-4">
                  <RemotionPlayerPreview
                    productName={product.name}
                    price={product.price ? Number(product.price) : undefined}
                    category={product.category}
                    scenes={analysisResult.storyboard.scenes}
                    imageUrls={product.assets
                      .filter((a) => (a.type === 'PRODUCT_IMAGE' || a.type === 'DETAIL_IMAGE') && a.url)
                      .map((a) => a.url)}
                    voiceAudioUrl={storyboardVoiceUrl || voicePreviewUrl || undefined}
                    renderedVideoUrl={renderedVideoUrl}
                  />

                  {renderedVideoUrl ? (
                    <a
                      href={renderedVideoUrl}
                      download={`${(product.name || 'tiktok_video').replace(/[^a-zA-Z0-9_-]/g, '_')}_1080x1920.mp4`}
                      className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                    >
                      <Download className="w-4 h-4" />
                      Tải video MP4 về máy (Chuẩn 100% khớp Preview)
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={isRenderingVideo}
                      onClick={handleStartGeneratingVideo}
                      className="w-full py-3 px-4 rounded-2xl bg-neutral-900 border border-neutral-700 hover:border-emerald-500/50 hover:bg-neutral-800 text-neutral-200 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      {isRenderingVideo ? 'Đang render video...' : 'Xuất & Tải Video MP4 chuẩn Preview'}
                    </button>
                  )}
                </div>

                {/* Right Column: Render MP4 Trigger & TikTok Publish */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Rendering Box */}
                  <div className="p-6 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-white">Xuất File Video MP4 (1080x1920)</h4>
                        <p className="text-xs text-neutral-400 mt-0.5">Dựng video chất lượng cao qua Remotion Studio Engine với đầy đủ âm thanh thuyết minh và nhạc nền TikTok.</p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        {selectedDuration}s • {analysisResult.storyboard.scenes.length} scenes
                      </span>
                    </div>

                    {isRenderingVideo ? (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="w-5 h-5 text-rose-500 animate-spin shrink-0" />
                          <p className="text-xs text-white font-medium">{generationProgress.stage}</p>
                        </div>
                        <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                          <div
                            className="bg-gradient-to-r from-rose-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${generationProgress.percent}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400 space-y-1">
                          {generationProgress.logs.slice(-2).map((l, i) => (
                            <p key={i}>✓ {l}</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartGeneratingVideo}
                        className="w-full py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wide bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-900/30 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Film className="w-4 h-4" />
                        {renderedVideoUrl ? 'Render lại Video MP4 khác' : 'Bắt đầu Render Video MP4 (Chuẩn 100% Khớp Preview)'}
                      </button>
                    )}
                  </div>

                  {/* TikTok Direct Publish Form */}
                  <div className="p-6 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center gap-2">
                          <Send className="w-4 h-4 text-rose-500" />
                          Đăng trực tiếp lên kênh TikTok (Direct Post)
                        </h4>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Sử dụng TikTok Content Posting API chính thức đã tích hợp.
                        </p>
                      </div>
                      {tiktokConnected ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                          Đã kết nối
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-mono">
                          Chưa kết nối
                        </span>
                      )}
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
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-rose-500 leading-relaxed"
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
                            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-rose-400 text-xs font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Settings toggles */}
                    <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300">Chế độ hiển thị (Privacy Level):</span>
                        <select
                          value={privacyLevel}
                          onChange={(e) => setPrivacyLevel(e.target.value as 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE')}
                          className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300"
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

                    {/* Publish Action Button */}
                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!renderedVideoUrl && !renderedVideoFile) {
                            handleStartGeneratingVideo()
                          } else {
                            handlePublishToTikTok()
                          }
                        }}
                        disabled={publishing || isRenderingVideo}
                        className="w-full py-3.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {publishing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang tải lên TikTok qua Content Posting API...
                          </>
                        ) : isRenderingVideo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang render video chuẩn Preview...
                          </>
                        ) : !renderedVideoUrl ? (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Render &amp; Đăng lên TikTok (Chuẩn 100% Khớp Preview)
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

              {/* Back button */}
              <div className="pt-4 border-t border-neutral-800 flex justify-start">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  ← Quay lại Bước 2 (Chỉnh kịch bản &amp; Hook)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
