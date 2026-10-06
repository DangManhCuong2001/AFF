import Link from 'next/link'
import { Film, ShoppingBag, ShieldCheck, ArrowRight, Play, Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 selection:bg-rose-500/30 selection:text-white">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          <Film className="w-3.5 h-3.5" />
          TikTok & TikTok Shop POC Integration
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Automated TikTok Direct Post & <br />
          <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-400 bg-clip-text text-transparent">
            Shoppable Video Verification
          </span>
        </h1>

        <p className="text-neutral-400 text-base max-w-xl mx-auto leading-relaxed">
          Official API integration test suite for TikTok Content Posting API and TikTok Shop Creator Showcase. Built strictly adhering to official developer requirements.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left text-xs font-mono">
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <Film className="w-4 h-4" /> Direct Post Pipeline
            </span>
            <p className="text-neutral-400">OAuth → Creator Info → MP4 Upload → Status Polling</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
            <span className="text-purple-400 font-semibold flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" /> TikTok Shop Creator
            </span>
            <p className="text-neutral-400">Shop Auth → Products → Precheck → Shoppable Link</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/create"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Tạo Video với AI (/create)
          </Link>

          <Link
            href="/tiktok-test"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 transition flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current text-rose-400" />
            TikTok Test Suite (/tiktok-test)
          </Link>

          <Link
            href="/integrations"
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-sm bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Status
            <ArrowRight className="w-4 h-4 text-neutral-500" />
          </Link>
        </div>
      </div>
    </div>
  )
}
