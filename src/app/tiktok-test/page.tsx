'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldCheck,
  Video,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Film,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Layers,
  Terminal,
  ShoppingBag,
} from 'lucide-react'

interface TikTokConnection {
  connected: boolean
  expired: boolean
  openId?: string
  scope?: string
  expiresInSeconds?: number
}

interface CreatorInfo {
  creatorAvatarUrl: string
  creatorUsername: string
  creatorNickname: string
  privacyLevelOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec: number
}

interface DebugLog {
  timestamp: string
  endpoint: string
  method: string
  status?: number
  errorCode?: string | number
  logId?: string
  requestSummary?: Record<string, unknown>
  responseSummary?: Record<string, unknown>
}

type PipelineStepStatus = 'idle' | 'running' | 'success' | 'failed' | 'blocked' | 'skipped'

interface PipelineStep {
  id: string
  name: string
  status: PipelineStepStatus
  message?: string
  logId?: string
}

export default function TikTokTestPage() {
  // Connection states
  const [connection, setConnection] = useState<TikTokConnection | null>(null)
  const [loadingConnection, setLoadingConnection] = useState(true)
  const [authError, setAuthError] = useState<{ error: string; description?: string; logId?: string } | null>(null)

  // Creator Info
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null)
  const [loadingCreator, setLoadingCreator] = useState(false)
  const [creatorError, setCreatorError] = useState<string | null>(null)

  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [fileValidationError, setFileValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Post Settings
  const [caption, setCaption] = useState('TikTok Direct Post Test via API #poc #tiktokapi')
  const [privacyLevel, setPrivacyLevel] = useState<string>('SELF_ONLY')
  const [allowComment, setAllowComment] = useState(true)
  const [allowDuet, setAllowDuet] = useState(true)
  const [allowStitch, setAllowStitch] = useState(true)
  const [isAigc, setIsAigc] = useState(false)

  // Pipeline Execution State
  const [isTesting, setIsTesting] = useState(false)
  const [publishId, setPublishId] = useState<string | null>(null)
  const [publishStatusText, setPublishStatusText] = useState<string | null>(null)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: 'auth', name: '1. TikTok Connection Verification', status: 'idle' },
    { id: 'creator', name: '2. Query Creator Info & Privileges', status: 'idle' },
    { id: 'validate_file', name: '3. MP4 File & Duration Validation', status: 'idle' },
    { id: 'init_post', name: '4. Initialize Direct Post API', status: 'idle' },
    { id: 'upload_video', name: '5. Upload MP4 Binary Bytes', status: 'idle' },
    { id: 'poll_status', name: '6. Poll TikTok Publish Processing', status: 'idle' },
    { id: 'shop_auth', name: '7. TikTok Shop Creator Auth (Phase E)', status: 'skipped', message: 'Ready in next phase' },
    { id: 'shop_products', name: '8. Load Showcase Products (Phase F)', status: 'skipped', message: 'Ready in next phase' },
    { id: 'precheck', name: '9. Shoppable Video Precheck (Phase G)', status: 'skipped', message: 'Ready in next phase' },
    { id: 'attach', name: '10. Shoppable Product Attachment (Phase H)', status: 'skipped', message: 'Ready in next phase' },
  ])

  // Debug Panel
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [debugOpen, setDebugOpen] = useState(false)

  // Callbacks for fetching data
  const fetchConnection = useCallback(async () => {
    setLoadingConnection(true)
    try {
      const res = await fetch('/api/tiktok/status')
      const data = await res.json()
      setConnection(data)
      return data
    } catch {
      setConnection({ connected: false, expired: false })
      return null
    } finally {
      setLoadingConnection(false)
    }
  }, [])

  const fetchCreatorInfo = useCallback(async () => {
    setLoadingCreator(true)
    setCreatorError(null)
    try {
      const res = await fetch('/api/tiktok/creator-info')
      const json = await res.json()
      if (!res.ok || json.error) {
        const msg = json.error?.message || 'Failed to query creator info'
        const code = json.error?.code ? `[${json.error.code}] ` : ''
        setCreatorError(`${code}${msg}`)
      } else if (json.creatorInfo) {
        setCreatorInfo(json.creatorInfo)
        const options = json.creatorInfo.privacyLevelOptions || []
        if (options.includes('SELF_ONLY')) {
          setPrivacyLevel('SELF_ONLY')
        } else if (options.length > 0) {
          setPrivacyLevel(options[0])
        }
      }
    } catch (err: unknown) {
      setCreatorError((err as Error)?.message || 'Failed to query creator info')
    } finally {
      setLoadingCreator(false)
    }
  }, [])

  const fetchDebugLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/tiktok/debug-logs')
      const data = await res.json()
      setDebugLogs(data.logs || [])
    } catch {
      // Ignore
    }
  }, [])

  // Load initial parameters and data on mount
  useEffect(() => {
    const init = async () => {
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search)
        const err = searchParams.get('error')
        const errDesc = searchParams.get('error_description')
        const logId = searchParams.get('log_id')
        if (err) {
          setAuthError({ error: err, description: errDesc || undefined, logId: logId || undefined })
        }
      }

      const conn = await fetchConnection()
      if (conn?.connected && !conn.expired) {
        await fetchCreatorInfo()
      }
      await fetchDebugLogs()
    }

    void init()
  }, [fetchConnection, fetchCreatorInfo, fetchDebugLogs])

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect TikTok?')) return
    try {
      await fetch('/api/tiktok/status', { method: 'DELETE' })
      setConnection({ connected: false, expired: false })
      setCreatorInfo(null)
      fetchDebugLogs()
    } catch (err) {
      alert('Failed to disconnect: ' + String(err))
    }
  }

  // Handle Video File selection & Duration
  const handleFileChange = (file: File | null) => {
    setFileValidationError(null)
    if (!file) {
      setVideoFile(null)
      setVideoPreviewUrl(null)
      setVideoDuration(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.mp4') && file.type !== 'video/mp4') {
      setFileValidationError('Only MP4 video files are accepted.')
      return
    }

    if (file.size <= 0) {
      setFileValidationError('File size cannot be 0 bytes.')
      return
    }

    setVideoFile(file)
    const objUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(objUrl)

    // Calculate duration
    const tempVideo = document.createElement('video')
    tempVideo.preload = 'metadata'
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration)
      if (creatorInfo?.maxVideoPostDurationSec && tempVideo.duration > creatorInfo.maxVideoPostDurationSec) {
        setFileValidationError(
          `Video duration (${tempVideo.duration.toFixed(1)}s) exceeds creator max limit of ${creatorInfo.maxVideoPostDurationSec}s.`
        )
      }
    }
    tempVideo.src = objUrl
  }

  // Pipeline step updater
  const updateStep = (id: string, status: PipelineStepStatus, message?: string, logId?: string) => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, message, logId } : s))
    )
  }

  // Run Direct Post Test
  const handleRunTikTokUploadTest = async () => {
    setIsTesting(true)
    setPublishId(null)
    setPublishStatusText(null)

    // Reset steps
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id.startsWith('shop_') || s.id === 'precheck' || s.id === 'attach' ? s : { ...s, status: 'idle', message: undefined }))
    )

    try {
      // Step 1: Check TikTok Auth
      updateStep('auth', 'running')
      const statusRes = await fetch('/api/tiktok/status')
      const statusData: TikTokConnection = await statusRes.json()
      if (!statusData.connected || statusData.expired) {
        updateStep('auth', 'failed', 'TikTok account is not connected or token has expired.')
        setIsTesting(false)
        fetchDebugLogs()
        return
      }
      updateStep('auth', 'success', `Connected (OpenID: ${statusData.openId || 'OK'})`)

      // Step 2: Creator Info
      updateStep('creator', 'running')
      let activeCreator = creatorInfo
      if (!activeCreator) {
        const cRes = await fetch('/api/tiktok/creator-info')
        const cJson = await cRes.json()
        if (!cRes.ok || cJson.error) {
          const errDetail = cJson.error?.message || 'Creator info query failed'
          const errCode = cJson.error?.code || 'UNKNOWN'
          updateStep('creator', 'failed', `[${errCode}] ${errDetail}`, cJson.error?.logId)
          setIsTesting(false)
          fetchDebugLogs()
          return
        }
        activeCreator = cJson.creatorInfo
        setCreatorInfo(activeCreator)
      }
      updateStep('creator', 'success', `@${activeCreator?.creatorUsername} (${activeCreator?.privacyLevelOptions?.join(', ')})`)

      // Step 3: Validate MP4
      updateStep('validate_file', 'running')
      if (!videoFile) {
        updateStep('validate_file', 'failed', 'No MP4 video file selected. Please select a file.')
        setIsTesting(false)
        return
      }

      if (videoDuration && activeCreator?.maxVideoPostDurationSec && videoDuration > activeCreator.maxVideoPostDurationSec) {
        updateStep('validate_file', 'failed', `Video duration exceeds creator maximum of ${activeCreator.maxVideoPostDurationSec}s`)
        setIsTesting(false)
        return
      }
      updateStep('validate_file', 'success', `${videoFile.name} (${(videoFile.size / (1024 * 1024)).toFixed(2)} MB, ${videoDuration?.toFixed(1) || '?'}s)`)

      // Step 4 & 5: Upload & Init Direct Post
      updateStep('init_post', 'running')
      updateStep('upload_video', 'running')

      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('title', caption)
      formData.append('privacyLevel', privacyLevel)
      formData.append('disableComment', String(!allowComment))
      formData.append('disableDuet', String(!allowDuet))
      formData.append('disableStitch', String(!allowStitch))
      formData.append('isAigc', String(isAigc))

      const uploadRes = await fetch('/api/tiktok/publish', {
        method: 'POST',
        body: formData,
      })

      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok || uploadJson.error) {
        const errDetail = uploadJson.error?.message || 'Direct Post upload failed'
        const errCode = uploadJson.error?.code || 'UPLOAD_ERROR'
        updateStep('init_post', 'failed', `[${errCode}] ${errDetail}`, uploadJson.error?.logId)
        updateStep('upload_video', 'failed', 'Upload halted due to initialization failure')
        setIsTesting(false)
        fetchDebugLogs()
        return
      }

      const activePublishId = uploadJson.publishId
      setPublishId(activePublishId)
      updateStep('init_post', 'success', `Publish ID: ${activePublishId}`)
      updateStep('upload_video', 'success', 'Binary chunks successfully streamed to TikTok storage')

      // Step 6: Polling publish status
      updateStep('poll_status', 'running', 'Polling TikTok processing status...')
      let attempts = 0
      const maxAttempts = 20
      let isCompleted = false

      while (attempts < maxAttempts && !isCompleted) {
        attempts++
        await new Promise((r) => setTimeout(r, 3000))

        const pollRes = await fetch(`/api/tiktok/publish-status?publish_id=${activePublishId}`)
        const pollJson = await pollRes.json()

        if (!pollRes.ok || pollJson.error) {
          const errDetail = pollJson.error?.message || 'Polling error'
          updateStep('poll_status', 'failed', `[${pollJson.error?.code}] ${errDetail}`, pollJson.error?.logId)
          isCompleted = true
          break
        }

        const rawStatus = pollJson.status
        setPublishStatusText(rawStatus)

        if (rawStatus === 'SUCCESS') {
          updateStep('poll_status', 'success', `Published successfully! Post IDs: ${pollJson.postIds?.join(', ') || 'N/A'}`)
          isCompleted = true
        } else if (rawStatus === 'FAILED') {
          updateStep('poll_status', 'failed', `TikTok processing failed: ${pollJson.failReason || 'Unknown reason'}`)
          isCompleted = true
        } else {
          updateStep('poll_status', 'running', `Processing (${rawStatus}) - attempt ${attempts}/${maxAttempts}...`)
        }
      }

      if (!isCompleted) {
        updateStep('poll_status', 'failed', 'Polling timed out after 60 seconds. Video may still be processing on TikTok servers.')
      }
    } catch (err: unknown) {
      alert('Test pipeline error: ' + (err as Error)?.message)
    } finally {
      setIsTesting(false)
      fetchDebugLogs()
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8 font-sans selection:bg-rose-500/30 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-neutral-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  TikTok Integration Proof of Concept
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                    Phase A-D
                  </span>
                </h1>
                <p className="text-sm text-neutral-400 mt-0.5">
                  Official TikTok Content Posting API Direct Post & Permission Verification
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchConnection()
                fetchDebugLogs()
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition flex items-center gap-1.5 text-neutral-300"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>
        </header>

        {/* Development / Un-audited Banner Notice */}
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">
              TikTok Developer App Compliance Notice
            </p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Development TikTok apps are restricted to private posts (<code className="bg-amber-900/50 px-1 py-0.5 rounded">SELF_ONLY</code>) until the Content Posting API audit is approved by TikTok. This test suite strictly respects TikTok API policy and will not attempt simulated public distribution.
            </p>
          </div>
        </div>

        {/* Error notification if callback returned error */}
        {authError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-200 text-sm flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300">TikTok Authorization Error: {authError.error}</p>
              {authError.description && (
                <p className="text-xs text-rose-200/90">{authError.description}</p>
              )}
              {authError.logId && (
                <p className="text-xs font-mono text-neutral-400">TikTok Log ID: {authError.logId}</p>
              )}
            </div>
          </div>
        )}

        {/* Section A: Connections & Capability Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* TikTok Connection Card */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                <h3 className="font-semibold text-sm text-neutral-200">TikTok Account</h3>
              </div>
              {loadingConnection ? (
                <span className="text-xs text-neutral-500 font-mono">Checking...</span>
              ) : connection?.connected && !connection.expired ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Connected
                </span>
              ) : connection?.expired ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Expired
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-medium">
                  Not Connected
                </span>
              )}
            </div>

            <div className="text-xs text-neutral-400 space-y-1 font-mono bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
              <p>
                Status:{' '}
                <span className={connection?.connected && !connection.expired ? 'text-emerald-400' : 'text-neutral-500'}>
                  {connection?.connected ? (connection.expired ? 'Token Expired' : 'Active Authorization') : 'Disconnected'}
                </span>
              </p>
              {connection?.openId && <p className="truncate">OpenID: {connection.openId}</p>}
              {connection?.expiresInSeconds !== undefined && (
                <p>Expires in: {Math.floor(connection.expiresInSeconds / 60)} mins</p>
              )}
            </div>

            <div className="flex gap-2">
                <div className="flex flex-col gap-2 w-full">
                  <a
                    href="/api/tiktok/auth"
                    className="w-full py-2 px-3 text-center rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {connection?.expired ? 'Reconnect TikTok' : 'Connect TikTok (Full Scopes)'}
                  </a>
                  <a
                    href="/api/tiktok/auth?scope=basic"
                    className="w-full py-1.5 px-3 text-center rounded-lg text-[11px] font-medium bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition flex items-center justify-center gap-1.5"
                  >
                    Test Connect with Basic Scope Only
                  </a>
                </div>
              ) : (
                <>
                  <a
                    href="/api/tiktok/auth"
                    className="flex-1 py-2 px-3 text-center rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                  >
                    Reconnect
                  </a>
                  <button
                    onClick={handleDisconnect}
                    className="py-2 px-3 rounded-lg text-xs font-medium bg-neutral-900 border border-rose-900/50 hover:bg-rose-950/40 text-rose-400 transition"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TikTok Shop Connection Card (Phase E Placeholder) */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                <h3 className="font-semibold text-sm text-neutral-200">TikTok Shop Creator</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                Phase E
              </span>
            </div>

            <div className="text-xs text-neutral-400 space-y-1 font-mono bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
              <p>Status: Pending Direct Post completion</p>
              <p>Target: Affiliate / Showcase APIs</p>
              <p>Scope: creator.video.write</p>
            </div>

            <button
              disabled
              className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-neutral-800/50 text-neutral-500 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Connect TikTok Shop (Next Phase)
            </button>
          </div>

          {/* Capability Detection Checklist */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
            <h3 className="font-semibold text-sm text-neutral-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Capability Detection
            </h3>

            <div className="text-xs space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">TikTok OAuth</span>
                <span className={connection?.connected ? 'text-emerald-400 font-medium' : 'text-neutral-500'}>
                  {connection?.connected ? 'READY' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Creator Info API</span>
                <span className={creatorInfo ? 'text-emerald-400 font-medium' : 'text-neutral-500'}>
                  {creatorInfo ? 'PASS' : 'UNTESTED'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Direct Upload (MP4)</span>
                <span className="text-emerald-400 font-medium">READY</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Shoppable Precheck</span>
                <span className="text-amber-500 font-mono">PHASE G</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-neutral-400">Product Attachment</span>
                <span className="text-amber-500 font-mono">PHASE H</span>
              </div>
            </div>
          </div>
        </div>

        {loadingCreator && (
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
            Loading TikTok Creator Profile & Privileges...
          </div>
        )}

        {creatorInfo && (
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {creatorInfo.creatorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creatorInfo.creatorAvatarUrl}
                  alt={creatorInfo.creatorUsername}
                  className="w-12 h-12 rounded-full border border-neutral-700 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-400">
                  {creatorInfo.creatorUsername?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  {creatorInfo.creatorNickname || creatorInfo.creatorUsername}
                  <span className="text-xs text-neutral-400 font-mono ml-2">@{creatorInfo.creatorUsername}</span>
                </p>
                <p className="text-xs text-neutral-400">
                  Max duration: {creatorInfo.maxVideoPostDurationSec}s • Comments: {creatorInfo.commentDisabled ? 'Disabled' : 'Enabled'} • Duet: {creatorInfo.duetDisabled ? 'Disabled' : 'Enabled'} • Stitch: {creatorInfo.stitchDisabled ? 'Disabled' : 'Enabled'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {creatorInfo.privacyLevelOptions.map((opt) => (
                <span
                  key={opt}
                  className="px-2 py-0.5 text-[11px] rounded bg-neutral-800 text-neutral-300 font-mono border border-neutral-700"
                >
                  {opt}
                </span>
              ))}
            </div>
          </div>
        )}

        {creatorError && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
            Creator Info Query Notice: {creatorError}
          </div>
        )}

        {/* Section B & C: Video Upload & Post Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section B: Video Dropzone */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base text-neutral-200 flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" />
                Local MP4 Video
              </h2>
              {videoFile && (
                <button
                  onClick={() => handleFileChange(null)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="hidden"
            />

            {!videoFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChange(e.dataTransfer.files[0])
                  }
                }}
                className="border-2 border-dashed border-neutral-700 hover:border-rose-500/50 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 bg-neutral-950/40"
              >
                <div className="p-3 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-neutral-200">
                  Click or drag and drop local MP4 video
                </p>
                <p className="text-xs text-neutral-500">
                  Standard MP4 file for end-to-end integration test
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-56 flex items-center justify-center border border-neutral-800">
                  {videoPreviewUrl && (
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Filename:</span>
                    <span className="text-neutral-200 truncate max-w-[200px]">{videoFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Size:</span>
                    <span className="text-neutral-200">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Duration:</span>
                    <span className="text-neutral-200">{videoDuration ? `${videoDuration.toFixed(1)}s` : 'Reading...'}</span>
                  </div>
                </div>
              </div>
            )}

            {fileValidationError && (
              <p className="text-xs text-rose-400 font-medium">{fileValidationError}</p>
            )}
          </div>

          {/* Section C: Post Settings */}
          <div className="p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
            <h2 className="font-semibold text-base text-neutral-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              TikTok Direct Post Settings
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Caption / Title (max 2200 chars)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-rose-500/50 resize-none font-sans"
                  placeholder="Enter video caption..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Privacy Level (from Creator Info API)
                </label>
                <select
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 focus:outline-none focus:border-rose-500/50"
                >
                  {creatorInfo?.privacyLevelOptions?.length ? (
                    creatorInfo.privacyLevelOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="SELF_ONLY">SELF_ONLY (Recommended for Dev Apps)</option>
                      <option value="PUBLIC_TO_EVERYONE">PUBLIC_TO_EVERYONE</option>
                      <option value="MUTUAL_FOLLOW_FRIENDS">MUTUAL_FOLLOW_FRIENDS</option>
                      <option value="FOLLOWER_OF_CREATOR">FOLLOWER_OF_CREATOR</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                <span className="text-xs font-medium text-neutral-400 block">Interaction Privileges:</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={allowComment}
                      onChange={(e) => setAllowComment(e.target.checked)}
                      disabled={creatorInfo?.commentDisabled}
                      className="rounded border-neutral-700 text-rose-500 focus:ring-0"
                    />
                    Comments
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={allowDuet}
                      onChange={(e) => setAllowDuet(e.target.checked)}
                      disabled={creatorInfo?.duetDisabled}
                      className="rounded border-neutral-700 text-rose-500 focus:ring-0"
                    />
                    Duet
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                    <input
                      type="checkbox"
                      checked={allowStitch}
                      onChange={(e) => setAllowStitch(e.target.checked)}
                      disabled={creatorInfo?.stitchDisabled}
                      className="rounded border-neutral-700 text-rose-500 focus:ring-0"
                    />
                    Stitch
                  </label>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80">
                    <input
                      type="checkbox"
                      checked={isAigc}
                      onChange={(e) => setIsAigc(e.target.checked)}
                      className="rounded border-neutral-700 text-rose-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-medium text-neutral-200">AI Generated Content (AIGC)</span>
                      <p className="text-[11px] text-neutral-400">
                        Flags <code>is_aigc: true</code> in Content Posting API metadata.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section D: Showcase Product (Phase F Preview) */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-neutral-300 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              TikTok Shop Showcase Products (Phase F)
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
              Next Phase
            </span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Product loading & Shoppable Video attachment will be enabled in Phase E & F after Direct Post verification.
          </p>
        </div>

        {/* Section E & 21: Pipeline Actions & Real-Time Test Steps */}
        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-rose-500" />
                End-to-End Test Execution Pipeline
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Executes official TikTok Content Posting API Direct Post flow with real MP4 file
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunTikTokUploadTest}
                disabled={isTesting || !connection?.connected || !videoFile}
                className="py-2.5 px-5 rounded-xl font-semibold text-xs bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing Pipeline...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Run TikTok Upload Test
                  </>
                )}
              </button>

              <button
                disabled
                className="py-2.5 px-4 rounded-xl font-medium text-xs bg-neutral-800/60 text-neutral-500 border border-neutral-700/50 cursor-not-allowed"
                title="Enabled in Phase H"
              >
                Run Full Shoppable Test (Phase H)
              </button>
            </div>
          </div>

          {publishId && (
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono flex items-center justify-between">
              <span className="text-neutral-400">
                Publish ID: <strong className="text-white">{publishId}</strong>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500">TikTok State:</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                  {publishStatusText || 'PROCESSING'}
                </span>
              </span>
            </div>
          )}

          {/* Pipeline Steps View */}
          <div className="space-y-2.5">
            {pipelineSteps.map((step) => (
              <div
                key={step.id}
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                  step.status === 'running'
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    : step.status === 'success'
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : step.status === 'failed'
                    ? 'bg-rose-950/30 border-rose-600/50 text-rose-300'
                    : step.status === 'blocked'
                    ? 'bg-amber-950/20 border-amber-600/40 text-amber-300'
                    : step.status === 'skipped'
                    ? 'bg-neutral-950/30 border-neutral-800/60 text-neutral-500'
                    : 'bg-neutral-950/50 border-neutral-800/80 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  {step.status === 'running' && (
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-400 shrink-0" />
                  )}
                  {step.status === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  {step.status === 'blocked' && (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  {(step.status === 'idle' || step.status === 'skipped') && (
                    <div className="w-4 h-4 rounded-full border border-neutral-700 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold">{step.name}</span>
                    {step.message && (
                      <p className="text-[11px] opacity-80 mt-0.5">{step.message}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                    {step.status}
                  </span>
                  {step.logId && (
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">log: {step.logId}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 23: Collapsible Debug Panel */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <button
            onClick={() => {
              setDebugOpen(!debugOpen)
              fetchDebugLogs()
            }}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-800/40 transition text-neutral-300 text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-rose-400" />
              <span>Debug Information & Raw API Responses ({debugLogs.length} events logged)</span>
            </div>
            {debugOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {debugOpen && (
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 space-y-4">
              <div className="flex justify-between items-center text-xs text-neutral-400">
                <p>Secrets and Access Tokens are automatically sanitized and never shown.</p>
                <button
                  onClick={async () => {
                    await fetch('/api/tiktok/debug-logs', { method: 'DELETE' })
                    setDebugLogs([])
                  }}
                  className="text-rose-400 hover:underline"
                >
                  Clear logs
                </button>
              </div>

              {debugLogs.length === 0 ? (
                <p className="text-xs text-neutral-500 font-mono">No API requests recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {debugLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 text-xs font-mono space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-neutral-400">
                        <span className="text-rose-400 font-bold">{log.method} {log.endpoint}</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span className="text-neutral-400">Status: <strong className={log.status && log.status < 400 ? 'text-emerald-400' : 'text-rose-400'}>{log.status || 'N/A'}</strong></span>
                        {log.errorCode && <span className="text-amber-400">ErrorCode: {log.errorCode}</span>}
                        {log.logId && <span className="text-neutral-400 truncate">LogId: {log.logId}</span>}
                      </div>
                      {log.responseSummary && (
                        <pre className="text-[11px] p-2 rounded bg-black/60 text-neutral-300 overflow-x-auto max-h-32">
                          {JSON.stringify(log.responseSummary, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
