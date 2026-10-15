import Link from 'next/link'
import Image from 'next/image'
import {
  Film,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Share2,
  Layers,
  Mic,
  Video,
  Lock,
  Zap,
  HelpCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const metadata = {
  title: 'Vipee - AI Video Studio & Direct Posting Platform for TikTok',
  description:
    'Generate high-converting eCommerce product videos with AI and publish directly to TikTok using official TikTok Content Posting APIs.',
}

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-rose-500/30 selection:text-white">
      {/* Top Navbar */}
      <nav className="w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo size="md" href="/" />

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
            <a href="#features" className="hover:text-white transition">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition">
              How It Works
            </a>
            <a href="#compliance" className="hover:text-white transition">
              TikTok Integration
            </a>
            <a href="#faq" className="hover:text-white transition">
              FAQ
            </a>
            <Link href="/privacy" className="hover:text-white transition">
              Privacy
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:opacity-95 text-white shadow-lg shadow-rose-500/20 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Launch Studio
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-neutral-800/60">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-rose-600/20 via-purple-600/15 to-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>Built with Official TikTok Content Posting API &amp; Login Kit</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.12]">
            Turn Products into Viral TikTok Videos with{' '}
            <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              Generative AI
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Vipee automates the end-to-end TikTok video creation pipeline: from multimodal product
            analysis and storyboard drafting to neural voiceovers and 1-click direct publishing to
            your TikTok account.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/create"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-xl shadow-rose-600/25 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Open AI Video Studio
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/integrations"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-rose-400" />
              View API Integrations
            </Link>
          </div>

          {/* Security & Compliance Highlights */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400 border-t border-neutral-900 mt-10">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Official TikTok OAuth (No password stored)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Commercial Music &amp; Ads Disclosure Ready
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              GDPR &amp; Full Data Deletion Support
            </span>
          </div>
        </div>
      </section>

      {/* 3-Step Workflow Section */}
      <section id="how-it-works" className="py-20 border-b border-neutral-800/60 bg-neutral-950/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
              Seamless Workflow
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              From Product Link to Published TikTok Video in 3 Steps
            </h2>
            <p className="text-sm text-neutral-400">
              Eliminate hours of manual editing, voice recording, and file transfers.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-base">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Import &amp; AI Analysis</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Provide a product image or eCommerce listing. Google Gemini multimodal AI identifies
                key selling points, audience pain points, and product benefits automatically.
              </p>
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
                &gt; Extracting visual hooks, pricing, and buyer intent...
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-base">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Smart Storyboard &amp; Voice</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                The engine composes a tailored 9:16 vertical storyboard with dynamic kinetic subtitles,
                persuasive copywriting, and studio-grade neural voiceovers synced to scene durations.
              </p>
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 font-mono">
                &gt; Synced 9:16 layout, captions, and 30fps animation ready.
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base">
                3
              </div>
              <h3 className="text-lg font-bold text-white">1-Click TikTok Direct Post</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Review your video in the web player and publish directly to your verified TikTok
                creator profile. Set titles, privacy controls, and branded content tags right from Vipee.
              </p>
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-emerald-400 font-mono">
                &gt; TikTok Content Posting API: Upload status 200 OK.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Features */}
      <section id="features" className="py-20 border-b border-neutral-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
              Cutting-Edge Technology
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Engineered Specifically for High-Converting TikTok Feeds
            </h2>
            <p className="text-sm text-neutral-400">
              Every detail is optimized for viewer retention, algorithmic favorability, and sales conversion.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">Remotion 9:16 Video Engine</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Pixel-perfect frame rendering with smooth CSS transitions, product carousels, and
                animated badge overlays that stop scrollers in their tracks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">Ultra-Realistic Neural Voices</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Integrations with ElevenLabs and neural speech synthesis provide human-like pacing,
                authentic inflection, and natural excitement.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">Official Direct Publishing</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Certified integration with TikTok Content Posting API. Push finished videos directly to
                creator drafts or live feed without downloading to your phone.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">OAuth Security &amp; Privacy</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                We use TikTok Login Kit. Your credentials remain safe with TikTok, and you maintain
                full authorization control with instant data wiping rights.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">Commerce Disclosure Controls</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Built-in controls for commercial music, branded content disclosures, and ad authorizations
                ensure 100% adherence to TikTok advertising policies.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold text-white">Cloud Rendering Speed</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Render full HD 1080×1920 MP4 files in seconds on modern edge infrastructure without
                overheating your local laptop.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Official TikTok Compliance Showcase */}
      <section id="compliance" className="py-20 border-b border-neutral-800/60 bg-neutral-950/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 relative overflow-hidden">
            <div className="max-w-2xl space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono">
                <ShieldCheck className="w-4 h-4" />
                TikTok Developer Platform Guidelines Compliant
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white">
                Built Strictly to Support Content Creators &amp; Merchants
              </h3>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Vipee follows official ByteDance/TikTok developer specifications. We respect user privacy,
                never ask for passwords, and provide transparent mechanisms for data deletion and authorization management.
              </p>
              <div className="pt-4 flex flex-wrap items-center gap-4 text-xs">
                <Link
                  href="/privacy"
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition inline-flex items-center gap-1.5"
                >
                  Read Privacy Policy
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </Link>
                <Link
                  href="/terms"
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition inline-flex items-center gap-1.5"
                >
                  Read Terms of Service
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </Link>
                <Link
                  href="/data-deletion"
                  className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition inline-flex items-center gap-1.5"
                >
                  User Data Deletion Instructions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 border-b border-neutral-800/60">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
              FAQ
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-neutral-400">
              Clear answers regarding privacy, authorization, and how our TikTok integration operates.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                Do I need to give Vipee my TikTok password?
              </h4>
              <p className="text-xs md:text-sm text-neutral-400 leading-relaxed pl-6">
                No, absolutely not. Authentication is handled entirely through the official TikTok OAuth dialog (Login Kit). We never see, collect, or store your account password.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                What permissions does Vipee ask for?
              </h4>
              <p className="text-xs md:text-sm text-neutral-400 leading-relaxed pl-6">
                We only request the minimal permissions needed to verify your creator status and transmit approved videos: `user.info.basic` (avatar &amp; display name) and `video.publish` (to publish your rendered videos to TikTok).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                Can I edit or preview the video before posting?
              </h4>
              <p className="text-xs md:text-sm text-neutral-400 leading-relaxed pl-6">
                Yes. Vipee provides a full interactive video player where you can review scene transitions, customize voiceover scripts, tweak captions, and select your preferred TikTok privacy settings (Public, Friends, or Private Draft) before publishing.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                How can I disconnect my account and delete my data?
              </h4>
              <p className="text-xs md:text-sm text-neutral-400 leading-relaxed pl-6">
                You can revoke access at any time directly in the TikTok mobile app under <em className="text-neutral-200">Settings &gt; Security &amp; permissions &gt; Manage app permissions</em>. You can also email <span className="text-rose-400 font-mono">privacy@vipee.io</span> for immediate total erasure of your records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-16 bg-gradient-to-b from-neutral-950 to-neutral-900/60 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-black text-white">
            Ready to Supercharge Your TikTok Video Pipeline?
          </h2>
          <p className="text-neutral-400 text-sm max-w-xl mx-auto">
            Experience automated AI video creation tailored for TikTok engagement and commerce.
          </p>
          <div className="pt-2">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-xl shadow-rose-600/30 transition"
            >
              <Sparkles className="w-4 h-4" />
              Start Creating in Studio
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer */}
      <footer className="py-12 bg-neutral-950 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 space-y-4">
            <BrandLogo size="md" href="/" />
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
              Vipee AI Video Studio empowers creators and eCommerce brands to generate high-performing TikTok videos with multimodal intelligence and direct API publishing.
            </p>
            <div className="text-[11px] text-neutral-500">
              Operated by Vipee AI Studio Pte. Ltd.
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-semibold text-neutral-200 text-xs tracking-wider uppercase">
              Product
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/create" className="hover:text-white transition">
                  AI Video Studio
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="hover:text-white transition">
                  TikTok API Status
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition">
                  Core Features
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="font-semibold text-neutral-200 text-xs tracking-wider uppercase">
              Compliance &amp; Legal
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/data-deletion" className="hover:text-white transition">
                  User Data Deletion
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@vipee.io"
                  className="hover:text-white transition"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500">
          <div>
            &copy; {new Date().getFullYear()} Vipee AI Studio. All rights reserved. Not affiliated with or endorsed by TikTok Inc. or ByteDance Ltd.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-neutral-400 transition">
              Terms
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-neutral-400 transition">
              Privacy
            </Link>
            <span>&bull;</span>
            <a href="mailto:privacy@vipee.io" className="hover:text-neutral-400 transition">
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
