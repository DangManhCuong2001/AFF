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
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Check,
  ShieldCheck,
  Flame,
} from 'lucide-react'
import {
  ProductInput,
  ProductCategory,
  ProductAsset,
  ProductAssetType,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
  StoryboardScene,
} from '@/engines/core/types'
import { CreativePlan, HookCandidate, StoryApproach } from '@/engines/creative/types'
import { VoicePersonality } from '@/engines/speech/types'
import type { VoiceProvider } from '@/lib/audio/provider'
import type { ContentPlan, ContentAngle } from '@/engines/planning/types'
import type {VideoDurationSelection} from '@/engines/planning/duration'
import { ContentPlanSummary } from '@/components/video/ContentPlanSummary'
import {loadProductImageBlob, prepareAnalysisImages} from '@/lib/ai/prepare-images'
import type { AnalysisImage } from '@/lib/ai/gemini'
import { attachContextImage, getContextImage } from '@/lib/ai/context-scenes'
import { isProductImage, withOpeningHook } from '@/engines/planning/AdaptiveVideoPlanner'
import { applySceneAudioTimings, hasCompleteSceneAudioTimings, parseSceneAudioTimings, sceneVoiceSignature, SceneAudioTiming } from '@/lib/video/scene-timing'
import { InfographicDeckViewer } from '@/components/infographic/InfographicDeckViewer'
import { CABLE_ORGANIZER_SEED_PRODUCT } from '@/engines/home/seed'
import { RemotionPlayerPreview } from '@/components/video/RemotionPlayerPreview'
import {VidsExperimentPanel} from '@/components/video/VidsExperimentPanel'
import {activeSceneVideos, planVidsShots, vidsPlanSignature, type SceneVideoClips, type VideoVisualMode} from '@/lib/video/vids-plan'
import { renderVideoOnClient, isClientExportSupported } from '@/lib/video/client-renderer'
import {hasPostingScope, requiredPostingScope, type TikTokPostingMode} from '@/lib/tiktok/posting-mode'
import {TikTokPostingModeSelector} from '@/components/video/TikTokPostingModeSelector'
import {sendTikTokVideo, fetchTikTokProgress, type TikTokUploadSession} from '@/lib/tiktok/upload-client'
import { useToast } from '@/components/ui/Toast'

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
    description: 'Quần áo, trang phục, dáng người, chất liệu (Sắp ra mắt)',
  },
  {
    id: 'accessories',
    name: 'Accessories',
    icon: '👜',
    isActive: false,
    description: 'Túi xách, trang sức, đồng hồ, phụ kiện mang theo (Sắp ra mắt)',
  },
  {
    id: 'beauty',
    name: 'Beauty & Skincare',
    icon: '💄',
    isActive: false,
    description: 'Mỹ phẩm, dưỡng da, chất kem, liệu trình (Sắp ra mắt)',
  },
  {
    id: 'perfume',
    name: 'Perfume',
    icon: '🌸',
    isActive: false,
    description: 'Nước hoa, tông mùi, phong cách, độ lưu hương (Sắp ra mắt)',
  },
  {
    id: 'tech',
    name: 'Tech Gadget',
    icon: '⚡',
    isActive: false,
    description: 'Thiết bị công nghệ, phụ kiện thông minh, bàn làm việc (Sắp ra mắt)',
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
  const [analysisStage, setAnalysisStage] = useState('Đang đọc ảnh & chọn cách kể chuyện...')
  const [useAIContext, setUseAIContext] = useState(false)
  const [isGeneratingContext, setIsGeneratingContext] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextRequiresSetup, setContextRequiresSetup] = useState(false)
  const [contextCanRetry, setContextCanRetry] = useState(true)
  const contextCacheRef = React.useRef<{signature: string; imageUrl: string} | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{
    analysis: ProductAnalysis
    strategy: VideoStrategy
    storyboard: VideoStoryboard
    creativePlan?: CreativePlan
    contentPlan?: ContentPlan
  } | null>(null)

  // Creative Director Engine State
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('google')
  const previewRequestRef = React.useRef<AbortController | null>(null)
  useEffect(() => {
    const savedProvider = localStorage.getItem('voice_provider')
    if (savedProvider === 'elevenlabs' || savedProvider === 'vibi' || savedProvider === 'vibi-capcut') {
      setVoiceProvider(savedProvider)
    }
  }, [])
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

  // Target video duration in seconds
  const [selectedDuration, setSelectedDuration] = useState<VideoDurationSelection>('auto')
  const selectedDurationLabel = selectedDuration === 'auto' ? 'Tự động' : `${selectedDuration}s`

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
  const [postingMode, setPostingMode] = useState<TikTokPostingMode>('publish')
  const [checkingPost, setCheckingPost] = useState(false)
  const [isAigc, setIsAigc] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const uploadSessionRef = React.useRef<{session: TikTokUploadSession; video: File} | null>(null)
  const [publishResult, setPublishResult] = useState<{
    mode: TikTokPostingMode
    phase: 'transferring' | 'processing' | 'inbox' | 'published' | 'failed'
    publishId?: string
    message: string
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
  const toast = useToast()

  // TikTok Connection State
  const [tiktokConnected, setTiktokConnected] = useState<boolean | null>(null)

  const [tiktokScope, setTiktokScope] = useState<string>()
  const canSendToTikTok = !!tiktokConnected && hasPostingScope(tiktokScope, postingMode)
  const changePostingMode = (mode: TikTokPostingMode) => {
    setPostingMode(mode)
    setPublishResult(null)
    try {localStorage.setItem('tiktok_posting_mode', mode)} catch { /* Preference storage is optional. */ }
  }
  useEffect(() => {
    try {if (localStorage.getItem('tiktok_posting_mode') === 'upload') setPostingMode('upload')} catch { /* Keep the default if storage is unavailable. */ }
  }, [])

  // Listen to OAuth redirect query params for instant notifications
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      toast.success('Kết nối TikTok thành công!', 'Tài khoản của bạn đã được liên kết với Vipee Studio.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('error')) {
      const errDesc = params.get('error_description') || params.get('error') || 'Vui lòng thử lại.'
      toast.error('Kết nối TikTok không thành công', errDesc)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [toast])

  React.useEffect(() => {
    fetch('/api/tiktok/status')
      .then((r) => r.json())
      .then((data) => {setTiktokConnected(!!data.connected && !data.expired); setTiktokScope(data.scope)})
      .catch(() => setTiktokConnected(false))
  }, [])

  const handleDisconnectTikTok = async () => {
    try {
      const res = await fetch('/api/tiktok/status', { method: 'DELETE' })
      if (res.ok) {
        setTiktokConnected(false)
        setTiktokScope(undefined)
        toast.info('Đã ngắt kết nối TikTok', 'Bạn có thể bấm nút "Kết nối TikTok" để bắt đầu quay video demo.')
      } else {
        toast.error('Lỗi ngắt kết nối', 'Không thể ngắt kết nối tài khoản.')
      }
    } catch {
      toast.error('Lỗi ngắt kết nối', 'Vui lòng thử lại.')
    }
  }

  // Rendered video state
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null)
  const [renderedVideoFile, setRenderedVideoFile] = useState<File | null>(null)

  const [voiceTimings, setVoiceTimings] = useState<SceneAudioTiming[]>([])
  // Experiments are opt-in per visit; never persist them as the image-flow default.
  const [visualMode, setVisualMode] = useState<VideoVisualMode>('images')
  const [vidsClipLimit, setVidsClipLimit] = useState<1 | 3>(1)
  const [vidsClips, setVidsClips] = useState<{signature: string; clips: SceneVideoClips}>({signature: '', clips: {}})
  const vidsShots = React.useMemo(() => planVidsShots(product, analysisResult?.storyboard.scenes || [], analysisResult?.contentPlan?.images, vidsClipLimit), [product, analysisResult?.storyboard.scenes, analysisResult?.contentPlan?.images, vidsClipLimit])
  const vidsSignature = React.useMemo(() => vidsPlanSignature(product, vidsShots), [product, vidsShots])
  const sceneVideos = React.useMemo(() => activeSceneVideos(visualMode, vidsShots, vidsClips.signature === vidsSignature ? vidsClips.clips : {}), [visualMode, vidsShots, vidsClips, vidsSignature])
  const introVideo = sceneVideos?.[vidsShots[0]?.sceneId]
  const supportingVideos = React.useMemo(() => sceneVideos ? Object.fromEntries(Object.entries(sceneVideos).filter(([id]) => id !== vidsShots[0]?.sceneId)) : undefined, [sceneVideos, vidsShots])
  const canRenderVisuals = visualMode === 'images' || !!Object.keys(sceneVideos || {}).length
  const changeVisualMode = (mode: VideoVisualMode) => {
    if (isRenderingVideo || publishing) return
    setVisualMode(mode)
    setRenderedVideoUrl(null)
    setRenderedVideoFile(null)
    setPublishResult(null)
    uploadSessionRef.current = null
  }
  const sceneVideosSignature = JSON.stringify({sceneVideos, introVideo})
  useEffect(() => {setRenderedVideoUrl(null); setRenderedVideoFile(null)}, [sceneVideosSignature])
  const voiceSourceRef = React.useRef<{url: string; signature: string; timings: SceneAudioTiming[]} | null>(null)
  const playbackScenes = React.useMemo(() => applySceneAudioTimings(analysisResult?.storyboard.scenes || [], voiceTimings), [analysisResult?.storyboard.scenes, voiceTimings])
  const playbackDuration = playbackScenes.reduce((sum, scene) => sum + scene.duration, 0)

  const voiceScript = JSON.stringify(analysisResult?.storyboard.scenes.map(({id, voice, headline, type, keywords}) => ({id, voice, headline, type, keywords})) || [])
  const speechScenes = React.useMemo<StoryboardScene[]>(() => JSON.parse(voiceScript), [voiceScript])
  useEffect(() => {
    setRenderedVideoUrl(null)
    setRenderedVideoFile(null)
  }, [analysisResult?.storyboard.scenes])

  // Automatically generate full Vietnamese voiceover for Storyboard scenes
  useEffect(() => {
    const scenes = speechScenes
    if (!scenes || scenes.length === 0) return

    setVoiceTimings([])
    voiceSourceRef.current = null
    setRenderedVideoUrl(null)
    setRenderedVideoFile(null)
    setStoryboardVoiceUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    let isSubscribed = true
    const controller = new AbortController()
    const fetchStoryboardVoice = async () => {
      try {
        setVoiceError(null)
        setIsGeneratingVoice(true)
        const res = await fetch('/api/audio/storyboard-voice', {
          signal: controller.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenes,
            voicePreset: selectedVoicePreset,
            voiceProvider,
          }),
        })
        if (!res.ok) {
          const error = await res.json().catch(() => ({}))
          throw new Error(error.error || 'Không thể tải giọng đọc')
        }
        const timings = parseSceneAudioTimings(res.headers.get('X-Segment-Timings'))
        if (!hasCompleteSceneAudioTimings(scenes, timings)) throw new Error('Chưa có đủ thời gian giọng đọc cho các cảnh. Vui lòng tạo lại giọng trước khi xuất video.')
        const blob = await res.blob()
        if (isSubscribed) {
          const url = URL.createObjectURL(blob)
          voiceSourceRef.current = {url, signature: sceneVoiceSignature(scenes), timings}
          setVoiceTimings(timings)
          setStoryboardVoiceUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        }
      } catch (err) {
        if (isSubscribed) setVoiceError(err instanceof Error ? err.message : 'Không thể tạo giọng đọc')
        console.warn('[AutoVoice] Failed to synthesize storyboard audio:', err)
      } finally {
        if (isSubscribed) setIsGeneratingVoice(false)
      }
    }

    fetchStoryboardVoice()

    return () => {
      isSubscribed = false
      controller.abort()
    }
  }, [speechScenes, selectedVoicePreset, voiceProvider])

  // Load Seed Product
  const handleLoadSeed = () => {
    setSelectedCategory('home')
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

  const addContextToResult = async (result: NonNullable<typeof analysisResult>, images: AnalysisImage[]) => {
    if (!useAIContext) {setContextError(null); setIsGeneratingContext(false); return result}
    setIsGeneratingContext(true)
    setContextError(null)
    setContextRequiresSetup(false)
    setContextCanRetry(true)
    setAnalysisStage('Đang tạo bối cảnh từ ảnh sản phẩm...')
    try {
      const primaryId = product.assets.find((asset) => asset.isPrimary && isProductImage(asset))?.id
      const reference = images.find((image) => image.assetId === primaryId) || images[0]
      if (!reference) throw new Error('Chưa đọc được ảnh để tạo bối cảnh. Hãy tải ảnh sản phẩm lên trực tiếp rồi thử lại.')
      const signature = `${product.name}|${product.category}|${reference.dataUrl}`
      let imageUrl = contextCacheRef.current?.signature === signature ? contextCacheRef.current.imageUrl : undefined
      if (!imageUrl) {
        const response = await fetch('/api/assets/context', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: product.name, category: product.category, reference})})
        const data = await response.json()
        if (!response.ok || !data.imageUrl) {
          setContextRequiresSetup(data.code === 'CONFIGURATION_REQUIRED')
          setContextCanRetry(data.code === 'CONFIGURATION_REQUIRED' || data.retryable !== false)
          throw new Error(data.error || 'Không thể tạo ảnh bối cảnh')
        }
        imageUrl = data.imageUrl as string
        contextCacheRef.current = {signature, imageUrl}
      }
      return {...result, storyboard: {...result.storyboard, scenes: attachContextImage(result.storyboard.scenes, imageUrl)}}
    } catch (error) {
      setContextError(error instanceof Error ? error.message : 'Không thể tạo ảnh bối cảnh')
      return result
    } finally {setIsGeneratingContext(false)}
  }

  const handleRetryContext = async () => {
    if (!analysisResult) return
    setIsGeneratingContext(true)
    const images = await prepareAnalysisImages(product.assets)
    setAnalysisResult(await addContextToResult(analysisResult, images))
  }

  const handleUploadContext = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !analysisResult) return
    setIsGeneratingContext(true)
    try {
      const images = await prepareAnalysisImages([{id: 'context-upload', type: 'PRODUCT_IMAGE', url: '', file}])
      if (!images[0]) throw new Error('Không đọc được ảnh bối cảnh đã tải lên')
      const sourceImages = await prepareAnalysisImages(product.assets)
      const primaryId = product.assets.find((asset) => asset.isPrimary && isProductImage(asset))?.id
      const reference = sourceImages.find((image) => image.assetId === primaryId) || sourceImages[0]
      let imageUrl = images[0].dataUrl
      if (reference) {
        const saved = await fetch('/api/assets/context', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: product.name, category: product.category, reference, existingImage: imageUrl})}).then(response => response.ok ? response.json() : null).catch(() => null)
        if (saved?.imageUrl) imageUrl = saved.imageUrl
        contextCacheRef.current = {signature: `${product.name}|${product.category}|${reference.dataUrl}`, imageUrl}
      }
      setAnalysisResult((previous) => previous ? {...previous, storyboard: {...previous.storyboard, scenes: attachContextImage(previous.storyboard.scenes, imageUrl)}} : previous)
      setContextError(null)
      setContextRequiresSetup(false)
    } catch (error) {setContextError(error instanceof Error ? error.message : 'Không tải được ảnh bối cảnh')}
    finally {setIsGeneratingContext(false); event.target.value = ''}
  }

  // Execute AI Product Analysis (Gemini API with Algorithmic Fallback)
  const handleAnalyzeProduct = async () => {
    if (analyzing || isRegeneratingAngle || isGeneratingContext || isRenderingVideo) return
    if (!product.name.trim()) {
      toast.warning('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm trước khi phân tích.')
      return
    }

    setAnalyzing(true)
    setAnalysisStage('Đang đọc ảnh & chọn cách kể chuyện...')
    try {
      const analysisImages = await prepareAnalysisImages(product.assets, {selectionPool: true})
      const res = await fetch('/api/engines/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          targetDuration: selectedDuration,
          angle: currentStep === 2 ? analysisResult?.contentPlan?.angle : undefined,
          analysisImages,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error('Phân tích thất bại', data.error || 'Không thể phân tích sản phẩm.')
        return
      }

      const result = await addContextToResult({analysis: data.analysis, strategy: data.strategy, storyboard: data.storyboard, creativePlan: data.creativePlan, contentPlan: data.contentPlan}, analysisImages)
      setAnalysisResult(result)
      if (data.contentPlan?.aiStatus && data.contentPlan.aiStatus.state !== 'completed') {
        toast.warning(data.contentPlan.aiStatus.state === 'partial' ? 'Gemini chỉ hoàn tất một phần' : 'Đang dùng kế hoạch dự phòng', data.contentPlan.aiStatus.message)
      } else toast.success('Phân tích thành công!', 'Đã tạo kịch bản 9:16 và kế hoạch video.')
      if (data.creativePlan?.selectedHook?.id) {
        setSelectedHookId(data.creativePlan.selectedHook.id)
      }
      if (data.creativePlan?.storyType) {
        setSelectedApproach(data.creativePlan.storyType)
      }
      setCurrentStep(2)
      setCaption(
        data.suggestedCaption ||
          `${data.strategy.hook} ${data.strategy.cta}`
      )
      setHashtags(
        data.suggestedHashtags || ['#sanpham', '#chonmua']
      )
    } catch (err: unknown) {
      toast.error('Lỗi phân tích', (err as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Hook alternatives share one buying reason, scene body and cached context image.
  const handleSelectHook = (candidate: HookCandidate) => {
    if (!analysisResult || isRenderingVideo || analyzing || isRegeneratingAngle || isGeneratingContext || analysisResult.strategy.hook === candidate.text) return
    setSelectedHookId(candidate.id)

    setAnalysisResult((prev) => {
      if (!prev) return prev
      const updatedScenes = withOpeningHook(prev.storyboard.scenes, candidate.text, prev.strategy.targetDuration, candidate.headline, {source: candidate.source, evidenceIds: candidate.evidenceIds})
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
              story: updatedScenes.map((scene) => scene.voice).join(' '),
              spokenScenes: updatedScenes.map((scene) => ({headline: scene.headline, voice: scene.voice})),
            }
          : undefined,
      }
    })

    setCaption(`${candidate.text} ${analysisResult.strategy.cta}`)
  }

  const handleGenerateAnotherAngle = async () => {
    if (!product.name.trim()) return
    setIsRegeneratingAngle(true)
    try {
      const angles: ContentAngle[] = ['design', 'features', 'fit']
      const current = analysisResult?.contentPlan?.angle || 'design'
      const angle = angles[(angles.indexOf(current) + 1) % angles.length]
      const analysisImages = await prepareAnalysisImages(product.assets, {selectionPool: true})
      const res = await fetch('/api/engines/analyze', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...product, targetDuration: selectedDuration, angle, analysisImages, geminiApiKey: geminiApiKey.trim() || undefined}),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Không thể đổi góc nội dung')
      setAnalysisResult(await addContextToResult({analysis: data.analysis, strategy: data.strategy, storyboard: data.storyboard, creativePlan: data.creativePlan, contentPlan: data.contentPlan}, analysisImages))
      setSelectedHookId(data.creativePlan?.selectedHook?.id || '')
      setCaption(data.suggestedCaption)
      setHashtags(data.suggestedHashtags)
    } catch (error) { alert(error instanceof Error ? error.message : 'Không thể đổi góc nội dung') }
    finally { setIsRegeneratingAngle(false) }
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
    const controller = new AbortController()
    previewRequestRef.current = controller

    try {
      const audioUrl = `/api/audio/tts?text=${encodeURIComponent(text)}&preset=${encodeURIComponent(selectedVoicePreset)}&provider=${voiceProvider}`
      const res = await fetch(audioUrl, { signal: controller.signal })
      if (!res.ok) throw new Error('Không thể tải giọng đọc')

      const blob = await res.blob()
      if (controller.signal.aborted) return
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
      if (controller.signal.aborted) return
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
    if (isRenderingVideo || isGeneratingVoice) return
    if (!canRenderVisuals) {toast.error('Chưa có clip Vids đã duyệt', 'Xem clip và đánh dấu đúng sản phẩm, hoặc chọn Từ ảnh để dùng luồng hiện tại.'); return}
    uploadSessionRef.current = null
    setPublishResult(null)
    const renderImageUrls: string[] = []
    setIsRenderingVideo(true)
    setGenerationProgress({
      stage: `1/4. Khởi tạo kịch bản ${playbackDuration.toFixed(1)}s theo nội dung...`,
      percent: 15,
      logs: ['Bắt đầu quy trình sản xuất video TikTok 9:16 thật...'],
    })

    try {
      let renderScenes = playbackScenes
      const formData = new FormData()
      if (visualMode === 'vids-experiment' && sceneVideos) {
        formData.append('visualMode', 'vids-experiment')
        formData.append('sceneVideos', JSON.stringify(Object.entries(sceneVideos).map(([sceneId, clip]) => ({sceneId, durationSec: clip.durationSec, frameAspect: clip.frameAspect, placement: sceneId === vidsShots[0]?.sceneId ? 'intro' : 'scene'}))))
        for (const [id, clip] of Object.entries(sceneVideos)) {
          const response = await fetch(clip.src)
          if (!response.ok) throw new Error('Không tải được clip đã lưu; chưa thể xuất bản thử nghiệm.')
          formData.append(`sceneVideo:${id}`, await response.blob(), 'clip.mp4')
        }
      }
      formData.append('productName', product.name)
      if (product.price) formData.append('price', String(product.price))
      if (product.category) formData.append('category', product.category)
      formData.append('voicePreset', selectedVoicePreset)
      formData.append('voiceProvider', voiceProvider)
      if (analysisResult?.storyboard) {
        formData.append('storyboard', JSON.stringify(analysisResult.storyboard))
      }

      // Attach all gallery images: both uploaded files and URL blobs pre-fetched by browser
      const candidateAssets = product.assets.filter(
        (a) => isProductImage(a) && (a.file || a.url)
      )

      const imageBlobs = await Promise.all(candidateAssets.map((asset, index) => loadProductImageBlob(asset).catch(() => {
        throw new Error(`Không tải được ảnh sản phẩm ${index + 1}. Vui lòng tải ảnh lên hoặc thử lại.`)
      })))
      for (const [index, blob] of imageBlobs.entries()) {
        formData.append('images', blob, candidateAssets[index].name || `product_asset_${index}.jpg`)
        renderImageUrls.push(URL.createObjectURL(blob))
      }

      const imageUrls = candidateAssets.filter((a) => a.url).map((a) => a.url!)
      if (imageUrls.length > 0) {
        formData.append('imageUrls', JSON.stringify(imageUrls))
      }

      // Single image fallback
      const primaryAsset = product.assets.find((a) => a.isPrimary) || candidateAssets[0]
      if (primaryAsset?.file) {
        formData.append('image', primaryAsset.file)
      }

      // Guarantee voice audio track: reuse existing preview audio or synthesize now
      const savedVoice = voiceSourceRef.current
      let activeVoiceUrl = savedVoice?.signature === sceneVoiceSignature(renderScenes) && hasCompleteSceneAudioTimings(renderScenes, savedVoice.timings) ? savedVoice.url : null
      if (activeVoiceUrl && savedVoice) renderScenes = applySceneAudioTimings(renderScenes, savedVoice.timings)
      if (!activeVoiceUrl && analysisResult?.storyboard?.scenes?.length) {
        try {
          console.log('[handleStartGeneratingVideo] Voice audio not ready, synthesizing on-demand...')
          const voiceRes = await fetch('/api/audio/storyboard-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenes: renderScenes,
              voicePreset: selectedVoicePreset,
              voiceProvider,
            }),
          })
          if (voiceRes.ok) {
            const timings = parseSceneAudioTimings(voiceRes.headers.get('X-Segment-Timings'))
            if (!hasCompleteSceneAudioTimings(renderScenes, timings)) throw new Error('Thiếu thời gian giọng đọc của một số cảnh; chưa thể đồng bộ để xuất video.')
            renderScenes = applySceneAudioTimings(renderScenes, timings)
            setVoiceTimings(timings)
            const voiceBlob = await voiceRes.blob()
            if (voiceBlob.size > 500) {
              activeVoiceUrl = URL.createObjectURL(voiceBlob)
              voiceSourceRef.current = {url: activeVoiceUrl, signature: sceneVoiceSignature(renderScenes), timings}
              setStoryboardVoiceUrl(activeVoiceUrl)
            }
          }
        } catch (voiceFetchErr) {
          console.warn('[handleStartGeneratingVideo] On-demand voice synthesis failed:', voiceFetchErr)
        }
      }

      formData.set('storyboard', JSON.stringify({scenes: renderScenes, totalDuration: renderScenes.reduce((sum, scene) => sum + scene.duration, 0)}))
      if (!activeVoiceUrl) throw new Error('Chưa tạo được giọng thuyết minh. Vui lòng thử lại hoặc đổi nhà cung cấp giọng đọc.')

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
          `Đồng bộ giọng đọc cho ${renderScenes.length} phân cảnh (${renderScenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(1)}s)`,
          `Lời thoại cảnh 1: "${analysisResult?.storyboard.scenes[0]?.voice || analysisResult?.strategy.hook}"`,
        ],
      }))

      // 1. Prioritize Client-side Remotion WebCodecs Renderer (100% exact match with Live on both Local & Production)
      const canClientRender = await isClientExportSupported()

      if (canClientRender && analysisResult?.storyboard?.scenes) {
        try {
          console.log('[handleStartGeneratingVideo] Launching Client-side Remotion WebCodecs Engine...')
          setGenerationProgress((prev) => ({
            stage: '3/4. Render Remotion WebCodecs 1080x1920 (Theo kế hoạch cảnh)...',
            percent: 50,
            logs: [
              ...prev.logs,
              'Kích hoạt Remotion Client Web-Renderer: Trực tiếp xuất video 1080x1920 từ trình duyệt',
              'Đồng bộ hoàn hảo toàn bộ đồ họa, font chữ, sticker và âm thanh',
            ],
          }))

          const clientResult = await renderVideoOnClient({
            sceneVideos: supportingVideos,
            introVideo,
            productName: product.name,
            price: product.price ? Number(product.price) : undefined,
            category: product.category,
            scenes: renderScenes,
            imageUrls: renderImageUrls,
            voiceAudioUrl: activeVoiceUrl || undefined,
            bgmAudioUrl: '/music/lofi-beat.mp3',
            fps: 30,
            onProgress: (pct, msg) => {
              setGenerationProgress((p) => ({
                ...p,
                percent: pct,
                logs: [...p.logs.slice(-4), msg],
              }))
            },
          })

          setRenderedVideoUrl(clientResult.blobUrl)
          setRenderedVideoFile(clientResult.file)

          setGenerationProgress((prev) => ({
            stage: `4/4. Hoàn tất video ${renderScenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(1)}s theo giọng đọc!`,
            percent: 100,
            logs: [
              ...prev.logs,
              `Xuất thành công: ${clientResult.fileName} (${(clientResult.blob.size / 1024).toFixed(1)} KB)`,
              'Video đã xuất, sẵn sàng xem lại và đăng lên TikTok.',
            ],
          }))
          return
        } catch (clientErr) {
          console.warn('[handleStartGeneratingVideo] Client-side render failed, falling back to server:', clientErr)
          setGenerationProgress((p) => ({
            ...p,
            logs: [
              ...p.logs,
              `Chuyển tiếp Server Render: ${(clientErr as Error)?.message || 'WebCodecs fallback'}`,
            ],
          }))
        }
      }

      setGenerationProgress((prev) => ({
        stage: '3/4. Render Remotion Studio 1080x1920 (Theo kế hoạch cảnh)...',
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
        stage: `4/4. Hoàn tất video ${renderScenes.reduce((sum, scene) => sum + scene.duration, 0).toFixed(1)}s theo giọng đọc!`,
        percent: 100,
        logs: [
          ...prev.logs,
          `Xuất thành công: ${fileName} (${(fileSizeBytes / 1024).toFixed(1)} KB)`,
          'Video MP4 sẵn sàng xem trước và đăng trực tiếp lên TikTok!',
        ],
      }))
      toast.success('Render video thành công!', 'Video MP4 9:16 đã sẵn sàng để xuất bản lên TikTok.')
    } catch (err: unknown) {
      toast.error('Lỗi render video', (err as Error).message)
    } finally {
      renderImageUrls.forEach((url) => URL.revokeObjectURL(url))
      setIsRenderingVideo(false)
    }
  }

  // File transfer and the eventual TikTok outcome are distinct states.
  useEffect(() => {
    const id = publishResult?.publishId
    const mode = publishResult?.mode
    if (!id || !mode || publishResult?.phase !== 'processing' || publishing) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const poll = async () => {
      attempts++
      let done = false
      try {
        const progress = await fetchTikTokProgress(id, mode, controller.signal)
        done = progress.terminal
        if (!controller.signal.aborted) setPublishResult((current) => current?.publishId === id ? {...current, phase: progress.phase, message: progress.message} : current)
      } catch {
        if (!controller.signal.aborted) setPublishResult((current) => current?.publishId === id ? {...current, message: 'Chưa đọc được kết quả từ TikTok. Bạn có thể kiểm tra lại trạng thái bên dưới.'} : current)
      }
      if (!controller.signal.aborted && !done && attempts < 30) timer = setTimeout(poll, 3000)
    }
    void poll()
    return () => {controller.abort(); if (timer) clearTimeout(timer)}
  }, [publishResult?.publishId, publishResult?.mode, publishResult?.phase, publishing])

  const handleCheckTikTokPost = async () => {
    const id = publishResult?.publishId
    const mode = publishResult?.mode
    if (!id || !mode) return
    setCheckingPost(true)
    try {
      const progress = await fetchTikTokProgress(id, mode)
      setPublishResult((current) => current?.publishId === id ? {...current, phase: progress.terminal ? progress.phase : current.phase, message: progress.message} : current)
    } catch (error) {toast.error('Chưa đọc được trạng thái', (error as Error).message)}
    finally {setCheckingPost(false)}
  }

  const handlePublishToTikTok = async () => {
    if (!canSendToTikTok || publishing || ['processing', 'inbox', 'published'].includes(publishResult?.phase || '')) return
    const mode = postingMode
    setPublishing(true)
    setPublishResult({mode, phase: 'transferring', message: 'Đang chuẩn bị phiên gửi video...'})
    let activePublishId: string | undefined
    try {
      const fullCaption = `${caption} ${hashtags.join(' ')}`.trim()
      let videoFile: File | null = renderedVideoFile
      if (!videoFile && renderedVideoUrl) {
        const response = await fetch(renderedVideoUrl, {signal: AbortSignal.timeout(20_000)})
        if (!response.ok) throw new Error('Không tải được file MP4 đã dựng.')
        videoFile = new File([await response.blob()], 'tiktok_video.mp4', {type: 'video/mp4'})
      }
      if (!videoFile) videoFile = product.assets.find((asset) => (asset.type === 'PRODUCT_VIDEO' || asset.type === 'DEMO_VIDEO') && asset.file)?.file || null
      if (!videoFile || videoFile.size <= 0) throw new Error('Vui lòng render video MP4 trước khi gửi.')
      if (mode === 'publish' && !fullCaption) throw new Error('Nhập caption trước khi đăng trực tiếp.')
      const session = uploadSessionRef.current?.video === videoFile && uploadSessionRef.current.session.mode === mode ? uploadSessionRef.current.session : undefined
      activePublishId = session?.publishId
      const result = await sendTikTokVideo(videoFile, {mode, title: fullCaption, privacyLevel, isAigc: isAigc || visualMode === 'vids-experiment', session,
        onSession: (session) => {uploadSessionRef.current = {session, video: videoFile!}},
        onProgress: (message) => setPublishResult((current) => current?.phase === 'transferring' ? {...current, message} : current),
        onInitialized: (id) => {
        activePublishId = id
        setPublishResult({mode, publishId: id, phase: 'transferring', message: 'Đang kết nối để chuyển file video tới TikTok...'})
      }})
      setPublishResult((current) => current?.publishId === result.publishId && ['inbox', 'published'].includes(current.phase) ? current : {mode, publishId: result.publishId, phase: 'processing', message: mode === 'upload' ? 'Đã gửi file. Đang chờ TikTok chuyển vào Inbox; video chưa được xuất bản.' : 'Đã gửi file. Đang chờ TikTok xác nhận xuất bản.'})
      toast.info('Đã gửi file tới TikTok', 'Theo dõi kết quả xử lý ở phần trạng thái bên dưới.')
    } catch (error) {
      const message = (error as Error).message || 'Không gửi được video tới TikTok.'
      setPublishResult((current) => current && ['inbox', 'published'].includes(current.phase) ? current : {mode, publishId: activePublishId, phase: 'failed', message: activePublishId ? `${message} Phiên gửi được giữ lại; kiểm tra trạng thái hoặc tiếp tục phiên này, không tạo yêu cầu mới.` : message})
      toast.error('Gửi video chưa thành công', message)
    } finally {setPublishing(false)}
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
                    Adaptive Planner Active
                  </span>
                </h1>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Tự động phân tích sản phẩm, lên kịch bản TikTok UGC &amp; xuất video với độ chân thực cao
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 max-w-full">
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

            <select aria-label="Cách gửi video TikTok" value={postingMode} disabled={publishing} onChange={(event) => changePostingMode(event.target.value as TikTokPostingMode)} className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300">
              <option value="publish">TikTok: Đăng trực tiếp</option><option value="upload">TikTok: Chuyển vào Inbox</option>
            </select>
            {tiktokConnected ? (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="px-2.5 py-1 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  TikTok Connected
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectTikTok}
                  className="px-2 py-1 text-xs font-medium text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  title="Ngắt kết nối tài khoản để kết nối lại"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href={`/api/tiktok/auth?scope=${postingMode}&returnTo=/create`}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-90 text-white shadow-lg shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5" />
                Kết nối TikTok
              </a>
            )}

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
              Chọn ngành hàng
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              Lập kế hoạch theo dữ liệu từng sản phẩm
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  if (cat.isActive) {
                    setSelectedCategory(cat.id)
                    setProduct((previous) => ({...previous, category: cat.id}))
                    setAnalysisResult(null)
                    setCurrentStep(1)
                  } else {
                    toast.info(
                      `${cat.name} Engine - Sắp ra mắt`,
                      'Engine kịch bản và animation chuyên sâu cho ngành hàng này đang được phát triển và sẽ ra mắt ở phiên bản tiếp theo!'
                    )
                  }
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

            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
              <label className="flex items-center gap-3 text-sm text-white font-semibold">
                <input type="checkbox" checked={useAIContext} onChange={(event) => setUseAIContext(event.target.checked)} className="accent-emerald-500" />
                Tạo bối cảnh sản phẩm bằng AI
              </label>
              <p className="text-xs text-neutral-400">Tạo một ảnh có sản phẩm trong bối cảnh phù hợp, dùng ở cảnh mở đầu và kết thúc. Dùng Cloudflare Workers AI. Giữ tài khoản Workers Free để dùng trong hạn mức miễn phí; ảnh được tái sử dụng khi đổi góc kể chuyện.</p>
            </div>

            {/* Automatic recommendation or a manually selected duration target. */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Chọn độ dài video TikTok
                </label>
                <span className="text-[11px] text-neutral-400 font-mono">
                  Đang chọn: <span className="text-amber-400 font-bold">{selectedDurationLabel}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <button type="button" aria-pressed={selectedDuration === 'auto'} onClick={() => setSelectedDuration('auto')} className={`sm:col-span-4 p-3 rounded-xl border text-left ${selectedDuration === 'auto' ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-neutral-800 bg-neutral-950/60'}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-sm text-white">Tự động — Gemini đề xuất</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Khuyên dùng</span></span>
                  <span className="block text-[11px] text-neutral-400 mt-2 leading-snug">Chọn độ dài theo nội dung, ưu tiên 20–30 giây khi đủ thông tin. Có thể ngắn hơn khi ít dữ liệu; không kéo dài bằng câu lặp.</span>
                </button>
                <button type="button" aria-pressed={selectedDuration === 22} onClick={() => setSelectedDuration(22)} className={`p-3 rounded-xl border text-left ${selectedDuration === 22 ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-800 bg-neutral-950/60'}`}><p className="font-bold text-sm text-white">22 Giây</p><p className="text-[11px] text-neutral-400 mt-2">Chọn mốc 22 giây làm mục tiêu</p></button>
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
                      Ngắn gọn
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Một ý chính, phù hợp khi ít ảnh và thông tin.
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
                      Nhiều thông tin
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Thêm chi tiết khi có đủ ảnh và thông tin có nguồn.
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
                      Chuyên sâu
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Chỉ dùng khi dữ liệu đủ; app có thể đề xuất bản ngắn hơn.
                  </p>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Giá và lựa chọn cần khớp trang sản phẩm. Video không tự thêm mức giá hoặc ưu đãi chưa xác minh.</span>
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
                  {analysisStage}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  TIẾP TỤC: PHÂN TÍCH &amp; LẬP KẾ HOẠCH VIDEO ({selectedDurationLabel})
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
                  {playbackDuration.toFixed(1)}s • {analysisResult.storyboard.scenes.length} phân cảnh
                </span>
              </div>
            </div>

            {analysisResult.contentPlan && <ContentPlanSummary plan={analysisResult.contentPlan} actualDuration={!isGeneratingVoice && storyboardVoiceUrl && voiceTimings.length === playbackScenes.length ? playbackDuration : undefined} onRetry={handleAnalyzeProduct} retrying={analyzing || isRegeneratingAngle || isGeneratingContext || isRenderingVideo} />}
            {contextError && <div role="alert" className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 space-y-2">
              <p>Chưa có ảnh bối cảnh: {contextError}</p>
              {contextRequiresSetup && <div className="space-y-2">
                <p>Cấu hình Account ID và API token Cloudflare trong .env.local, sau đó khởi động lại app. Gemini API key chỉ dùng cho phân tích và kịch bản.</p>
                <div className="flex flex-wrap gap-3">
                  <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="underline">Mở Cloudflare Workers AI</a>
                  <a href="https://developers.cloudflare.com/workers-ai/get-started/rest-api/" target="_blank" rel="noreferrer" className="underline">Hướng dẫn cấu hình Cloudflare</a>
                </div>
              </div>}
              {contextCanRetry && <button type="button" disabled={isGeneratingContext || isRegeneratingAngle || analyzing} onClick={handleRetryContext} className="px-3 py-2 rounded-lg bg-neutral-800 text-white disabled:opacity-50">{isGeneratingContext ? 'Đang tạo...' : contextRequiresSetup ? 'Đã cấu hình Cloudflare — kiểm tra lại' : 'Thử tạo bối cảnh lại'}</button>}
            </div>}
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 text-xs text-neutral-300 space-y-2">
              <label className="block font-semibold">Dùng ảnh bối cảnh có sẵn
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadContext} disabled={isGeneratingContext || isRegeneratingAngle || isRenderingVideo || analyzing} className="mt-2 block w-full text-neutral-400" />
              </label>
              <p className="text-neutral-500">Tải ảnh rõ toàn bộ sản phẩm để dùng cho cảnh mở đầu và kết thúc. Thay ảnh bối cảnh không tạo lại voice.</p>
            </div>
            {getContextImage(analysisResult.storyboard.scenes) && <p className="text-xs text-emerald-300">Đã có ảnh bối cảnh. Cảnh mở đầu và kết thúc trong preview và bản xuất dùng cùng ảnh này.</p>}

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
                          Nội dung theo ảnh và thông tin sản phẩm
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAnotherAngle}
                      disabled={isRegeneratingAngle || isGeneratingContext}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Đổi giữa thiết kế, thông tin sản phẩm và hướng dẫn chọn mua"
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
                        {analysisResult.contentPlan?.format || selectedApproach}
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

                  {/* Hook options ranked by grounded editorial criteria. */}
                  <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        Các cách mở đầu, cùng một trọng tâm
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Xếp theo độ rõ và nội dung có nguồn
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(analysisResult.creativePlan?.hookCandidates || [
                        {
                          id: 'hook-1',
                          text: analysisResult.strategy.hook,
                          type: 'curiosity' as const,
                          scores: {},
                          reasoning: 'Câu mở đầu dựa trên thông tin đã có',
                        },
                      ]).map((candidate, index) => {
                        const isSelected = selectedHookId === candidate.id || (!selectedHookId && candidate.id === analysisResult.creativePlan?.selectedHook?.id)
                        return (
                          <div
                            key={candidate.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-disabled={isRenderingVideo || analyzing || isRegeneratingAngle || isGeneratingContext}
                            onKeyDown={(event) => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); handleSelectHook(candidate as HookCandidate)}}}
                            onClick={() => handleSelectHook(candidate as HookCandidate)}
                            className={`p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col gap-1.5 ${
                              isSelected
                                ? 'bg-rose-950/30 border-rose-500 shadow-md shadow-rose-950/50'
                                : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-rose-400 font-bold uppercase">
                                {candidate.source === 'gemini' ? 'Gemini' : candidate.source === 'rules' ? 'Dự phòng' : candidate.type}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {index === 0 && candidate.editorialScore && <span className="text-[10px] text-amber-300">Gợi ý</span>}
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

                    <label className="block space-y-2 text-xs text-neutral-300">
                      <span>Nhà cung cấp giọng đọc</span>
                      <select
                        value={voiceProvider}
                        disabled={isRenderingVideo || publishing}
                        onChange={(event) => {
                          const nextProvider = event.target.value as VoiceProvider
                          previewRequestRef.current?.abort()
                          previewAudioRef.current?.pause()
                          previewAudioRef.current = null
                          setIsVoicePlaying(false)
                          setIsVoiceLoading(false)
                          setVoicePreviewUrl((previous) => {
                            if (previous) URL.revokeObjectURL(previous)
                            return null
                          })
                          setStoryboardVoiceUrl((previous) => {
                            if (previous) URL.revokeObjectURL(previous)
                            return null
                          })
                          setRenderedVideoUrl(null)
                          setRenderedVideoFile(null)
                          localStorage.setItem('voice_provider', nextProvider)
                          setVoiceProvider(nextProvider)
                        }}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
                      >
                        <option value="google">Google — Test video</option>
                        <option value="elevenlabs">ElevenLabs — Video chính thức</option>
                        <option value="vibi">Vibi — ElevenLabs</option>
                        <option value="vibi-capcut">Vibi — CapCut</option>
                      </select>
                      <p className="text-[11px] text-neutral-500">
                        {voiceProvider === 'google'
                          ? 'Giọng Google Translate tiếng Việt. Không sử dụng credits ElevenLabs; các preset phong cách không đổi giọng Google.'
                          : voiceProvider === 'vibi'
                            ? 'Giọng ElevenLabs được tạo qua Vibi bằng Voice ID chính đã cấu hình; nghe thử và tạo video đều sử dụng credits Vibi.'
                            : voiceProvider === 'vibi-capcut'
                              ? 'Giọng CapCut tiếng Việt được tạo qua Vibi bằng Voice ID CapCut riêng; mức credits phụ thuộc giá hiển thị của Vibi.'
                            : 'Giọng ElevenLabs, sử dụng credits khi nghe thử và tạo thuyết minh.'}
                      </p>
                    </label>

                    {voiceError && <p role="alert" className="text-xs text-red-400">{voiceError}</p>}

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
                      Giọng đọc được tạo theo từng cảnh; thời lượng preview được cập nhật theo âm thanh thực tế.
                    </p>
                  </div>

                  {/* 5. Authentic OfferEngine Guard */}
                  <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-300 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      OfferEngine &amp; CTA Tự nhiên:
                    </div>
                    <p className="italic text-white">
                      &quot;{analysisResult.creativePlan?.cta || analysisResult.strategy.cta}&quot;
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
                      {analysisResult.storyboard.scenes.length} cảnh • {playbackDuration.toFixed(1)}s
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {playbackScenes.map((scene, idx) => (
                      <div
                        key={scene.id}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-400 text-[11px] flex items-center gap-1.5">
                            Scene {idx + 1} • {scene.type.toUpperCase()}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
                            {scene.duration.toFixed(1)}s
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
                        {scene.renderPlan && <div className="space-y-1 text-[11px] text-neutral-400">
                          <p>Mục đích: {scene.renderPlan.purpose}</p>
                          <p>Ảnh: {product.assets.filter(isProductImage)[scene.renderPlan.assetIndex]?.name || `Ảnh ${scene.renderPlan.assetIndex + 1}`} · {scene.renderPlan.framing === 'detail' ? 'Cận chi tiết' : 'Toàn ảnh'}</p>
                          {scene.renderPlan.evidenceIds.length > 0 && <p>Nguồn: {scene.renderPlan.evidenceIds.map((id) => analysisResult.contentPlan?.facts.find((fact) => fact.id === id)?.source === 'image' ? 'Quan sát ảnh' : 'Thông tin bạn nhập').join(' · ')}</p>}
                        </div>}
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
            <VidsExperimentPanel mode={visualMode} onModeChange={changeVisualMode} clipLimit={vidsClipLimit} onClipLimitChange={setVidsClipLimit} product={product} shots={vidsShots} signature={vidsSignature} onClipsChange={setVidsClips} disabled={isRenderingVideo || publishing} />
            {useAIContext && !getContextImage(analysisResult.storyboard.scenes) && <div role="alert" className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <p>Chưa có ảnh bối cảnh: {contextError || 'Ảnh chưa được tạo hoặc tải lên.'}</p>
              <button type="button" onClick={() => setCurrentStep(2)} className="px-3 py-2 rounded-lg bg-neutral-800 text-white">Quay lại tạo / tải ảnh bối cảnh</button>
            </div>}
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
              scenes={playbackScenes}
              duration={playbackDuration}
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
                    sceneVideos={supportingVideos}
                    introVideo={introVideo}
                    productName={product.name}
                    price={product.price ? Number(product.price) : undefined}
                    category={product.category}
                    scenes={playbackScenes}
                    imageUrls={product.assets
                      .filter((a) => isProductImage(a) && a.url)
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
                      Tải video MP4 về máy
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={isRenderingVideo || isGeneratingVoice || isGeneratingContext || !canRenderVisuals || !product.assets.some(isProductImage)}
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
                        {playbackDuration.toFixed(1)}s • {analysisResult.storyboard.scenes.length} scenes
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
                        disabled={isRenderingVideo || isGeneratingVoice || !canRenderVisuals}
                        className="w-full py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wide bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-900/30 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Film className="w-4 h-4" />
                        {renderedVideoUrl ? 'Render lại Video MP4 khác' : 'Bắt đầu Render Video MP4 '}
                      </button>
                    )}
                  </div>

                  {/* TikTok Direct Post or Upload-to-Inbox */}
                  <div className="p-6 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center gap-2">
                          <Send className="w-4 h-4 text-rose-500" />
                          Gửi video tới TikTok
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

                    <TikTokPostingModeSelector value={postingMode} disabled={publishing} onChange={changePostingMode} />
                    {postingMode === 'upload' && <p className="rounded-xl bg-sky-950/30 border border-sky-800/40 p-3 text-xs leading-relaxed text-sky-200">Video sẽ được chuyển vào Inbox, chưa xuất bản. Bạn cần mở thông báo trong ứng dụng TikTok, hoàn tất caption, nhãn AI và đăng video. Nếu tài khoản hỗ trợ gắn sản phẩm, thực hiện bước đó trong TikTok.</p>}
                    {!canSendToTikTok && <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 space-y-2 text-xs text-amber-200">
                      <p>{tiktokConnected ? `Tài khoản chưa cấp quyền ${requiredPostingScope(postingMode)} cho cách gửi này.` : 'Kết nối tài khoản TikTok trước khi gửi video.'}</p>
                      <a href={`/api/tiktok/auth?scope=${postingMode}&returnTo=/create`} className="inline-block rounded-lg bg-amber-500 px-3 py-2 font-semibold text-neutral-950">{tiktokConnected ? 'Kết nối lại để cấp quyền' : 'Kết nối TikTok'}</a>
                    </div>}

                    {/* Caption & Hashtags */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-300 block">
                        {postingMode === 'upload' ? 'Caption để sao chép sang TikTok:' : 'Caption TikTok:'}
                      </label>
                      <textarea
                        rows={3}
                        disabled={publishing}
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

                    {postingMode === 'upload' && <div className="space-y-2 text-xs text-neutral-400">
                      <p>Caption và hashtag không tự chuyển qua API Upload. Sao chép nội dung rồi dán khi hoàn tất đăng trong TikTok.</p>
                      <button type="button" className="rounded-lg border border-neutral-700 px-3 py-2 text-neutral-200 hover:bg-neutral-800" onClick={async () => {
                        try {await navigator.clipboard.writeText(`${caption} ${hashtags.join(' ')}`.trim()); toast.success('Đã sao chép caption', 'Dán nội dung khi hoàn tất đăng trong TikTok.')}
                        catch {toast.error('Chưa sao chép được', 'Bạn có thể chọn và sao chép nội dung caption thủ công.')}
                      }}>Sao chép caption và hashtag</button>
                    </div>}

                    {/* Direct Post settings are completed in TikTok for Inbox uploads. */}
                    {postingMode === 'publish' && <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                        <span className="text-neutral-300">Chế độ hiển thị (Privacy Level):</span>
                        <select
                          value={privacyLevel}
                          onChange={(e) => setPrivacyLevel(e.target.value as 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE')}
                          className="max-w-full min-w-0 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300"
                        >
                          <option value="SELF_ONLY">SELF_ONLY (Bắt buộc khi đang chờ TikTok duyệt)</option>
                          <option value="PUBLIC_TO_EVERYONE">PUBLIC_TO_EVERYONE (Công khai)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-300">Gắn nhãn nội dung do AI tạo (is_aigc):</span>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={isAigc || visualMode === 'vids-experiment'}
                            disabled={visualMode === 'vids-experiment'}
                            onChange={(e) => setIsAigc(e.target.checked)}
                            className="rounded border-neutral-700 text-rose-600 focus:ring-0"
                          />
                          <span className={isAigc || visualMode === 'vids-experiment' ? 'text-rose-400' : 'text-neutral-400'}>
                            {isAigc || visualMode === 'vids-experiment' ? 'Bật (Gắn nhãn do AI tạo)' : 'Tắt (Không gắn nhãn AI)'}
                          </span>
                        </label>
                      </div>
                    </div>}

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
                        disabled={publishing || isRenderingVideo || isGeneratingVoice || !canSendToTikTok || ['processing', 'inbox', 'published'].includes(publishResult?.phase || '')}
                        className="w-full py-3.5 px-5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {publishing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            {postingMode === 'upload' ? 'Đang chuyển video sang TikTok...' : 'Đang gửi video tới TikTok...'}
                          </>
                        ) : isRenderingVideo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang render video chuẩn Preview...
                          </>
                        ) : !renderedVideoUrl && !renderedVideoFile ? (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Render MP4 trước khi gửi
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {publishResult?.phase === 'inbox' ? 'TikTok đã xác nhận chuyển vào Inbox' : publishResult?.phase === 'published' ? 'TikTok đã xác nhận xuất bản' : publishResult?.phase === 'processing' ? 'Đang chờ TikTok xử lý...' : publishResult?.phase === 'failed' && publishResult.publishId ? 'Tiếp tục phiên gửi video' : postingMode === 'upload' ? 'Chuyển vào Inbox TikTok' : 'Đăng trực tiếp lên TikTok'}
                          </>
                        )}
                      </button>
                    </div>
                    {publishResult && <div role="status" aria-live="polite" className={`rounded-xl border p-3 text-xs space-y-2 ${publishResult.phase === 'failed' ? 'border-rose-700/50 bg-rose-950/20 text-rose-200' : publishResult.phase === 'inbox' || publishResult.phase === 'published' ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200' : 'border-sky-700/40 bg-sky-950/20 text-sky-200'}`}>
                      <p className="leading-relaxed">{publishResult.message}</p>
                      {publishResult.phase === 'inbox' && <p className="leading-relaxed">Chưa thấy thông báo? Kiểm tra đúng tài khoản TikTok đã kết nối, làm mới Hộp thư và mở thông báo tải video. Không cần gửi lại video này.</p>}
                      {publishResult.publishId && <><p className="font-mono text-[10px] break-all text-neutral-500">Mã xử lý: {publishResult.publishId}</p><button type="button" onClick={handleCheckTikTokPost} disabled={checkingPost} className="rounded-lg border border-current/30 px-3 py-1.5 disabled:opacity-50">{checkingPost ? 'Đang kiểm tra...' : 'Kiểm tra lại trạng thái'}</button></>}
                    </div>}
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
