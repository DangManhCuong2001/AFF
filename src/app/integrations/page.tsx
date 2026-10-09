'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Film,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'

interface TikTokConnection {
  connected: boolean
  expired: boolean
  openId?: string
  scope?: string
  expiresInSeconds?: number
}

export default function IntegrationsPage() {
  const [tiktokConn, setTiktokConn] = useState<TikTokConnection | null>(null)
  const [loading, setLoading] = useState(true)

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tiktok/status')
      const data = await res.json()
      setTiktokConn(data)
    } catch {
      setTiktokConn({ connected: false, expired: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    fetch('/api/tiktok/status')
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setTiktokConn(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!ignore) {
          setTiktokConn({ connected: false, expired: false })
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/tiktok-test"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to /tiktok-test
          </Link>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-lg text-xs bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition flex items-center gap-1.5 text-neutral-300"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

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
            <h1 className="text-2xl font-bold tracking-tight text-white">Vipee Integrations</h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              Manage official OAuth connections for TikTok Content Posting &amp; TikTok Shop Creator
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* TikTok Content Posting Integration */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">TikTok Content Posting API</h2>
                  <p className="text-xs text-neutral-400">Direct Post, video upload & publish status polling</p>
                </div>
              </div>

              {loading ? (
                <span className="text-xs text-neutral-500">Checking...</span>
              ) : tiktokConn?.connected && !tiktokConn.expired ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : tiktokConn?.expired ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Expired
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5" /> Not Connected
                </span>
              )}
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-500">Required Scopes:</span>
                <span className="text-neutral-300">user.info.basic, video.publish, video.upload</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Redirect URI:</span>
                <span className="text-neutral-300">/api/tiktok/callback</span>
              </div>
              {tiktokConn?.openId && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Connected OpenID:</span>
                  <span className="text-neutral-200">{tiktokConn.openId}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href="/api/tiktok/auth"
                className="py-2 px-4 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {tiktokConn?.connected ? 'Reconnect TikTok Account' : 'Connect TikTok Account'}
              </a>

              <Link
                href="/tiktok-test"
                className="py-2 px-4 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
              >
                Go to Test Suite
              </Link>
            </div>
          </div>

          {/* TikTok Shop Creator Integration */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 opacity-80">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">TikTok Shop Creator Partner API</h2>
                  <p className="text-xs text-neutral-400">Affiliate Showcase products & Shoppable video linkage</p>
                </div>
              </div>

              <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                Planned for Phase E
              </span>
            </div>

            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-500">Required Scope:</span>
                <span className="text-neutral-300">creator.video.write</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Request Signer:</span>
                <span className="text-neutral-300">HMAC-SHA256 (Implemented in Phase E)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
