import Link from 'next/link'
import { ArrowLeft, Scale, ShieldCheck, AlertCircle, FileCheck, HelpCircle, CheckCircle } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const metadata = {
  title: 'Terms of Service | Vipee - AI Video Studio for TikTok',
  description: 'Terms and conditions governing the use of Vipee AI Video Studio and official TikTok API integrations.',
}

export default function TermsPage() {
  const lastUpdated = 'October 15, 2026'

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-rose-500/30 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo size="md" href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition px-3 py-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-neutral-800/60 bg-gradient-to-b from-rose-950/20 via-neutral-950/60 to-neutral-950 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono mb-4">
            <Scale className="w-3.5 h-3.5" />
            Legal Terms &amp; Conditions
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-2xl">
            Please read these Terms of Service carefully before utilizing Vipee (&quot;Platform&quot;, &quot;Service&quot;, &quot;we&quot;, or &quot;us&quot;). 
            By accessing or using our video creation tools and connecting your TikTok account, you signify your agreement to be legally bound by these terms.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Effective Date: {lastUpdated}
            </span>
            <span>&bull;</span>
            <span>Version: 2.4.0</span>
            <span>&bull;</span>
            <span>Governed under Commercial Technology Standards</span>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 leading-relaxed text-neutral-300">
        {/* Core Principles */}
        <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-rose-400" />
            Agreement Overview
          </h2>
          <p className="text-xs md:text-sm text-neutral-300">
            These Terms govern your use of the Vipee AI Video Creation Engine, rendering pipeline, and direct publishing integrations with TikTok. 
            If you do not agree with any part of these Terms, you must immediately cease accessing or using our platform.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Description of Service</h2>
          </div>
          <p className="text-sm">
            Vipee is an AI-powered SaaS platform designed for content creators, digital marketers, and eCommerce sellers. Our services include:
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>Multimodal product analysis and automated video storyboard generation.</li>
            <li>Synthetic human-like voiceover generation via text-to-speech technologies.</li>
            <li>Programmatic video compilation, visual motion graphics, and audio mixing.</li>
            <li>Direct post authorization and video transmission to TikTok accounts utilizing the official TikTok Content Posting API and Login Kit.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Eligibility &amp; TikTok Account Authorization</h2>
          </div>
          <div className="space-y-3 text-sm">
            <p>
              To use our direct posting features, you must authenticate through TikTok&apos;s official OAuth dialog (Login Kit). By connecting your TikTok account:
            </p>
            <ul className="space-y-2 list-disc list-inside text-neutral-300 pl-2">
              <li>You represent that you are at least 18 years old and legally capable of forming a binding contract.</li>
              <li>You confirm that you are the lawful owner or authorized administrator of the connected TikTok account.</li>
              <li>You acknowledge that you can revoke this connection at any time through TikTok&apos;s in-app permission settings or our dashboard.</li>
              <li>You understand that Vipee does not store or request your TikTok password at any time.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 - TIKTOK COMPLIANCE (CRITICAL FOR TIKTOK REVIEW) */}
        <section className="space-y-4 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">3. Compliance with TikTok Platform Policies</h2>
          </div>
          <p className="text-sm text-neutral-300">
            As a condition of using our TikTok publishing features, you agree to strictly comply with all official TikTok policies and guidelines:
          </p>
          <ul className="text-xs md:text-sm space-y-2 list-disc list-inside text-neutral-200">
            <li>
              You must adhere to the{' '}
              <a href="https://www.tiktok.com/community-guidelines" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                TikTok Community Guidelines
              </a>{' '}
              and must not create or post content that is deceptive, misleading, infringing, hateful, or harmful.
            </li>
            <li>
              You agree to be bound by the{' '}
              <a href="https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                TikTok Developer Terms of Service
              </a>{' '}
              and the general{' '}
              <a href="https://www.tiktok.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                TikTok Terms of Service
              </a>.
            </li>
            <li>
              You must adhere to the{' '}
              <a href="https://ads.tiktok.com/help/article/commercial-content-policy" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                TikTok Commercial Content &amp; Branded Content Policies
              </a>. If your video promotes a commercial product or paid endorsement, you must enable the commercial content disclosure toggle before publishing.
            </li>
            <li>
              You are solely responsible for ensuring that product claims made in your videos (pricing, efficacy, discounts) comply with local advertising and consumer protection laws.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Intellectual Property &amp; Content Ownership</h2>
          </div>
          <div className="space-y-3 text-sm">
            <p>
              <strong className="text-white">Your Content:</strong> You retain complete ownership of all media, brand assets, product photos, trademarks, and text that you upload or generate through Vipee. By using our rendering and direct posting pipeline, you grant Vipee a limited, non-exclusive license solely to process, render, and transmit your media files to TikTok on your behalf.
            </p>
            <p>
              <strong className="text-white">Our Platform:</strong> All software, algorithms, user interfaces, branding, visual styles, and proprietary rendering pipelines of Vipee remain the exclusive intellectual property of Vipee AI Studio and its licensors.
            </p>
            <p>
              <strong className="text-white">Third-Party Assets:</strong> Any stock audio, fonts, or templates provided inside Vipee are licensed for commercial video creation. Users may not extract, resell, or distribute these assets on a standalone basis outside of videos created on the platform.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              5
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Prohibited Uses</h2>
          </div>
          <p className="text-sm">You agree that you will not:</p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs md:text-sm">
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <span className="text-rose-400 font-bold block mb-1">Unlawful Content</span>
              Generate or publish content that violates copyright, privacy, or trademark rights of any third party.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <span className="text-rose-400 font-bold block mb-1">Spam &amp; Automation</span>
              Use automated bots, scrapers, or excessive bulk calls to abuse our rendering servers or bypass TikTok rate limits.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <span className="text-rose-400 font-bold block mb-1">Reverse Engineering</span>
              Decompile, reverse engineer, or attempt to derive the source code of Vipee&apos;s rendering or planning engine.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <span className="text-rose-400 font-bold block mb-1">Harmful Content</span>
              Upload malware, defamatory statements, sexually explicit content, or dangerous product promotions.
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              6
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">AI Technology Disclaimers</h2>
          </div>
          <p className="text-sm">
            Vipee leverages generative AI models (such as Google Gemini and neural text-to-speech) to assist your creative process. You understand and accept that:
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li>AI outputs (scripts, captions, descriptions) may occasionally contain inaccuracies or hallucinated attributes.</li>
            <li>You must inspect, review, and approve the generated video content and voiceover script prior to initiating publishing to your TikTok audience.</li>
            <li>Vipee is not liable for claims arising from unreviewed or misleading AI-generated marketing statements.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              7
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Disclaimer of Warranties &amp; Limitation of Liability</h2>
          </div>
          <div className="space-y-3 text-sm">
            <p className="text-xs uppercase tracking-wider text-neutral-400 font-mono">
              AS IS / AS AVAILABLE BASIS
            </p>
            <p>
              THE PLATFORM AND SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. 
              WE DO NOT GUARANTEE THAT THE PLATFORM WILL ALWAYS BE SECURE, ERROR-FREE, OR UNINTERRUPTED, NOR DO WE GUARANTEE ANY SPECIFIC AUDIENCE REACH OR COMMERCIAL SALES METRICS ON TIKTOK.
            </p>
            <p>
              IN NO EVENT SHALL VIPEE, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE OR TIKTOK API ACTIONS.
            </p>
          </div>
        </section>

        {/* Section 8 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              8
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Termination &amp; Suspension</h2>
          </div>
          <p className="text-sm">
            We reserve the right to suspend or terminate your access to Vipee at our discretion, without prior notice, if you breach any provision of these Terms, violate TikTok Community Guidelines, or engage in fraudulent activities. 
            Upon termination, your right to use our platform and APIs ceases immediately.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              9
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Governing Law &amp; Dispute Resolution</h2>
          </div>
          <p className="text-sm">
            These Terms shall be governed by and construed in accordance with standard international commercial and technology arbitration principles. 
            Any dispute arising from or related to these Terms shall first be resolved through good-faith informal negotiations before initiating formal legal proceedings.
          </p>
        </section>

        {/* Section 10 - Contact Information */}
        <section className="space-y-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              10
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Questions &amp; Contact Information</h2>
          </div>
          <p className="text-sm text-neutral-300">
            For questions or legal inquiries regarding these Terms of Service, please reach out to our team:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs md:text-sm text-neutral-300 pt-2">
            <div>
              <span className="text-neutral-400 block text-xs">Entity:</span>
              <strong className="text-white">Vipee AI Studio Pte. Ltd.</strong>
            </div>
            <div>
              <span className="text-neutral-400 block text-xs">Legal Counsel Desk:</span>
              <a href="mailto:legal@vipee.io" className="text-rose-400 hover:underline font-mono">
                legal@vipee.io
              </a>
            </div>
            <div>
              <span className="text-neutral-400 block text-xs">Customer Support:</span>
              <a href="mailto:support@vipee.io" className="text-rose-400 hover:underline font-mono">
                support@vipee.io
              </a>
            </div>
            <div>
              <span className="text-neutral-400 block text-xs">Website:</span>
              <Link href="/" className="text-rose-400 hover:underline">
                https://vipee.io
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/80 py-8 text-center text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" showText={false} href="/" />
            <span>&copy; {new Date().getFullYear()} Vipee AI Studio. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-rose-400 font-semibold">
              Terms of Service
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-neutral-300 transition">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link href="/" className="hover:text-neutral-300 transition">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
