import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
          <BrandLogo size="md" href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-neutral-400">Last updated: October 2026</p>

        <div className="space-y-4 text-sm text-neutral-300 leading-relaxed">
          <p>
            Your privacy is important to us. This policy outlines how Vipee collects, handles, and protects user data.
          </p>
          <h2 className="text-lg font-semibold text-white">1. Information We Collect</h2>
          <p>
            We only collect data strictly necessary to facilitate the TikTok Content Posting integration, such as your TikTok OpenID and API access tokens.
          </p>
          <h2 className="text-lg font-semibold text-white">2. TikTok API Data Usage</h2>
          <p>
            Data received via TikTok APIs is used exclusively to display creator info and publish video content requested by you. We do not sell user data to third parties.
          </p>
        </div>
      </div>
    </div>
  )
}
