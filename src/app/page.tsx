import Link from 'next/link'
import Image from 'next/image'
import { Film, ShoppingBag, ShieldCheck, ArrowRight, Play, Sparkles } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-rose-500/30 selection:text-white">
      {/* Top Navbar */}
      <nav className="w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo size="md" href="/" />
          
          <div className="flex items-center gap-4 text-xs font-medium">
            <Link
              href="/create"
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Studio
            </Link>
            <Link
              href="/tiktok-test"
              className="text-neutral-400 hover:text-white transition hidden sm:inline-block"
            >
              Test Suite
            </Link>
            <Link
              href="/integrations"
              className="text-neutral-400 hover:text-white transition hidden sm:inline-block"
            >
              Integrations
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 my-12">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Brand Icon Display */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500 opacity-30 blur-xl group-hover:opacity-50 transition duration-500" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <Image
                  src="/vipee-icon-512.png"
                  alt="Vipee App Icon"
                  width={96}
                  height={96}
                  priority
                  className="rounded-2xl"
                />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <Film className="w-3.5 h-3.5" />
              Vipee • TikTok &amp; TikTok Shop POC Integration
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Automated TikTok Direct Post &amp; <br />
            <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-400 bg-clip-text text-transparent">
              Shoppable Video Verification
            </span>
          </h1>

          <p className="text-neutral-400 text-base max-w-xl mx-auto leading-relaxed">
            Vipee is the official content workflow tool and AI video studio for TikTok creators and TikTok Shop sellers. Built strictly adhering to official developer requirements.
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
      </main>

      {/* Footer with Compliance Links */}
      <footer className="border-t border-neutral-800/80 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" showText={false} href="/" />
            <span>&copy; {new Date().getFullYear()} Vipee. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-neutral-300 transition">
              Terms of Service
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-neutral-300 transition">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
