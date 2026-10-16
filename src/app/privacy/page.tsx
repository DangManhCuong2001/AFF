import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Eye, Trash2, Mail, CheckCircle2, FileText, Globe, Server } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const metadata = {
  title: 'Privacy Policy | Vipee - AI Video Studio for TikTok',
  description: 'Learn how Vipee collects, protects, uses, and deletes your data when using our AI Video Studio and TikTok API integrations.',
}

export default function PrivacyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            Official Legal Documentation
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-2xl">
            At Vipee (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), we respect your privacy and are committed to protecting your personal data. 
            This Privacy Policy explains how our AI Video Studio collects, processes, stores, and safeguards your information when you connect with TikTok services.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Effective Date: {lastUpdated}
            </span>
            <span>&bull;</span>
            <span>Version: 2.4.0</span>
            <span>&bull;</span>
            <span>Applicable globally (GDPR, CCPA &amp; TikTok Platform Terms compliant)</span>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 leading-relaxed text-neutral-300">
        {/* Important Summary Card */}
        <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-rose-400" />
            Key Privacy Commitments at a Glance
          </h2>
          <ul className="text-xs md:text-sm space-y-2 text-neutral-300 list-disc list-inside">
            <li><strong className="text-white">Zero Data Selling:</strong> We never sell, rent, or monetize your personal information or TikTok creator data to data brokers or third parties.</li>
            <li><strong className="text-white">Minimum Necessary Scope:</strong> We only request TikTok API permissions strictly necessary to generate videos and post them directly to your TikTok account at your explicit request.</li>
            <li><strong className="text-white">Full User Control:</strong> You can disconnect your TikTok account and request complete deletion of all associated data at any time.</li>
            <li><strong className="text-white">Enterprise-grade Security:</strong> Sensitive tokens and media assets are encrypted in transit via TLS 1.3 and at rest with AES-256 encryption.</li>
          </ul>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Information We Collect</h2>
          </div>
          <p className="text-sm">
            When you interact with Vipee, we collect information depending on how you use our application:
          </p>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80 space-y-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-rose-400" />
                TikTok Account Data (via Login Kit)
              </h3>
              <p className="text-xs text-neutral-400">
                When you authenticate via TikTok Login Kit and authorize our app, we receive:
              </p>
              <ul className="text-xs text-neutral-300 list-disc list-inside space-y-1">
                <li>TikTok OpenID (an anonymized unique identifier)</li>
                <li>Display name &amp; Profile avatar URL</li>
                <li>Temporary OAuth Access Token &amp; Refresh Token (encrypted)</li>
                <li>Account verification and creator region info</li>
              </ul>
              <p className="text-[11px] text-neutral-400 italic">
                * Note: We never receive, store, or have access to your TikTok password.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/80 space-y-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-400" />
                Content &amp; Studio Assets
              </h3>
              <p className="text-xs text-neutral-400">
                Data generated or uploaded while creating video projects:
              </p>
              <ul className="text-xs text-neutral-300 list-disc list-inside space-y-1">
                <li>Product images, titles, and descriptions input into the editor</li>
                <li>Generated video scripts, storyboards, and audio voiceovers</li>
                <li>Video rendering settings and output MP4 files</li>
                <li>Post metadata (captions, hashtags, privacy levels, commercial disclosure toggles)</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60 mt-3">
            <h3 className="text-xs font-semibold text-neutral-200 mb-1 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-neutral-400" />
              Technical Logs &amp; Usage Information
            </h3>
            <p className="text-xs text-neutral-400">
              We collect standard technical information automatically when you use our platform, including browser type, operating system version, referral URLs, IP address for bot/DDoS mitigation, and API error diagnostic logs.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">How We Use Your Information</h2>
          </div>
          <p className="text-sm">
            We use the collected data strictly to operate, maintain, and deliver the services requested by you:
          </p>
          <ul className="text-sm space-y-2.5 list-disc list-inside">
            <li><strong className="text-white">Facilitating TikTok Direct Posting:</strong> Transmitting your rendered video and post parameters (title, privacy level, commercial music/sponsorship tags) directly to TikTok servers through the official TikTok Content Posting API.</li>
            <li><strong className="text-white">AI Content Creation:</strong> Analyzing provided product information to generate high-converting video scripts, motion design storyboards, and realistic synthetic voiceovers.</li>
            <li><strong className="text-white">Rendering Engine Execution:</strong> Assembling images, captions, audio, and visual animations into vertical video formats (9:16) optimized for TikTok feeds.</li>
            <li><strong className="text-white">Account Management &amp; Security:</strong> Authenticating your session, preventing abusive automated requests, and validating token expirations.</li>
            <li><strong className="text-white">Legal &amp; Policy Compliance:</strong> Ensuring compliance with the TikTok Developer Terms of Service, TikTok Community Guidelines, and applicable national laws.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Third-Party Services &amp; Data Transfers</h2>
          </div>
          <p className="text-sm">
            Vipee integrates with trusted infrastructure and AI providers to deliver core functionalities:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <h4 className="text-sm font-semibold text-white">1. TikTok / ByteDance Pte. Ltd. (Platform API)</h4>
              <p className="text-xs text-neutral-400 mt-1">
                When you initiate direct publishing, video files and metadata are transferred to TikTok in accordance with the{' '}
                <a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                  TikTok Privacy Policy
                </a>{' '}
                and the{' '}
                <a href="https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline hover:text-rose-300">
                  TikTok Developer Terms of Service
                </a>.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <h4 className="text-sm font-semibold text-white">2. Google Gemini AI (Multimodal Analysis)</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Product images and text descriptions may be processed via Google Gemini APIs exclusively to analyze product attributes and create storyboard ideas. No personal identity data is shared with Google.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <h4 className="text-sm font-semibold text-white">3. ElevenLabs &amp; Microsoft Edge TTS (Voice Synthesis)</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Audio voiceovers are generated from your approved video script. Only script text strings are sent to voice synthesis engines; no user identifiers are attached.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Data Retention &amp; Storage</h2>
          </div>
          <p className="text-sm">
            We adhere to data minimization principles. We do not retain data longer than is strictly necessary:
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">OAuth Tokens:</strong> TikTok access tokens and refresh tokens are stored securely in encrypted format and are deleted immediately upon account disconnection or token expiration.</li>
            <li><strong className="text-white">Rendered Video Files:</strong> Video files rendered in the studio are temporarily stored on our secure media servers for a maximum of 48 hours to allow download or retry posting, after which they are permanently purged.</li>
            <li><strong className="text-white">Audit &amp; Diagnostic Logs:</strong> Anonymous server interaction logs are retained for 30 days for debugging, rate-limit defense, and security analytics.</li>
          </ul>
        </section>

        {/* Section 5 - USER DATA DELETION (CRITICAL FOR TIKTOK REVIEW) */}
        <section className="space-y-4 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold text-sm">
              <Trash2 className="w-4 h-4" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">5. User Data Deletion Instructions</h2>
          </div>
          <p className="text-sm text-neutral-300">
            In compliance with TikTok Developer Policy and global privacy regulations (GDPR Article 17, CCPA), users have the right to request the complete deletion of their account data and revoked authorizations at any time.
          </p>

          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-semibold text-white">Method A: Revoke Access Directly via TikTok App</h3>
            <ol className="text-xs md:text-sm text-neutral-300 space-y-1.5 list-decimal list-inside pl-2">
              <li>Open your <strong className="text-white">TikTok</strong> mobile application.</li>
              <li>Go to your <strong className="text-white">Profile</strong> and tap the hamburger menu icon (three lines) at the top-right corner.</li>
              <li>Select <strong className="text-white">Settings and privacy</strong> &gt; <strong className="text-white">Security &amp; permissions</strong>.</li>
              <li>Tap on <strong className="text-white">Manage app permissions</strong>.</li>
              <li>Locate <strong className="text-white">Vipee</strong> in the authorized apps list and tap <strong className="text-rose-400 font-semibold">Remove access</strong>.</li>
            </ol>
            <p className="text-xs text-neutral-400 italic">
              * Once access is revoked, our access tokens are immediately invalidated and our system will cease all communications with your TikTok account.
            </p>
          </div>

          <div className="space-y-3 mt-4 pt-4 border-t border-rose-500/20">
            <h3 className="text-sm font-semibold text-white">Method B: Direct Request to Our Data Protection Officer</h3>
            <p className="text-xs md:text-sm text-neutral-300">
              You can also request immediate manual wiping of all your stored data (tokens, media drafts, logs) by emailing us:
            </p>
            <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs md:text-sm">
                <Mail className="w-4 h-4 text-rose-400" />
                <span className="font-mono text-white">privacy@vipee.io</span>
                <span className="text-neutral-400">(or support@vipee.io)</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                Within 48h Response
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Please include your TikTok Display Name or OpenID in the subject line. We will process and confirm deletion within 48 hours.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              6
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Data Security &amp; Protection</h2>
          </div>
          <p className="text-sm">
            We employ administrative, technical, and physical safeguards designed to protect personal data against unauthorized access, destruction, loss, alteration, or disclosure:
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">Encrypted Transmission:</strong> All data transmissions between your browser, our servers, and TikTok endpoints utilize modern TLS 1.3 cryptographic protocols.</li>
            <li><strong className="text-white">Encrypted Storage:</strong> Access credentials and refresh tokens are encrypted at rest with industry-standard AES-256 algorithms.</li>
            <li><strong className="text-white">Restricted Access:</strong> Access to production servers is strictly limited to authorized engineers subject to role-based access control and two-factor authentication.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              7
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Your Privacy Rights (GDPR &amp; CCPA)</h2>
          </div>
          <p className="text-sm">
            Depending on your jurisdiction (such as the European Economic Area, UK, or California), you hold legal rights regarding your personal information, including:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs md:text-sm">
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800">
              <strong className="text-white block mb-1">Right to Access</strong>
              Request confirmation and copies of personal data we retain about you.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800">
              <strong className="text-white block mb-1">Right to Erasure (To Be Forgotten)</strong>
              Request deletion of your personal data where statutory grounds exist.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800">
              <strong className="text-white block mb-1">Right to Rectification</strong>
              Request correction of inaccurate or incomplete personal information.
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800">
              <strong className="text-white block mb-1">Right to Withdraw Consent</strong>
              Revoke permission to access third-party integrations at any time without penalty.
            </div>
          </div>
        </section>

        {/* Section 8 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              8
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Children&apos;s Privacy</h2>
          </div>
          <p className="text-sm">
            Vipee is strictly designed for commercial creators and eCommerce businesses aged 18 and older (or the age of legal majority in your country). 
            We do not knowingly collect, store, or solicit personal data from children under the age of 13 (or under 16 in certain EU jurisdictions). If you discover that a child has provided us with personal information, please contact us immediately and we will promptly remove such records.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              9
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Policy Amendments</h2>
          </div>
          <p className="text-sm">
            We may revise this Privacy Policy periodically to reflect technological updates, product enhancements, or adjustments in TikTok platform guidelines. 
            The updated revision date at the top of this page indicates the most recent modification. Continued use of our application after any change constitutes acceptance of the revised policy.
          </p>
        </section>

        {/* Section 10 - Contact Information */}
        <section className="space-y-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-sm">
              10
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Contact Us</h2>
          </div>
          <p className="text-sm text-neutral-300">
            If you have questions, inquiries, concerns regarding our privacy practices, or if you wish to exercise your data rights, please contact our Legal &amp; Data Protection team:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs md:text-sm text-neutral-300 pt-2">
            <div>
              <span className="text-neutral-400 block text-xs">Organization:</span>
              <strong className="text-white">Vipee AI Studio Pte. Ltd.</strong>
            </div>
            <div>
              <span className="text-neutral-400 block text-xs">Direct Support &amp; Privacy Desk:</span>
              <a href="mailto:privacy@vipee.io" className="text-rose-400 hover:underline font-mono">
                privacy@vipee.io
              </a>
            </div>
            <div>
              <span className="text-neutral-400 block text-xs">General Inquiries:</span>
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
            <Link href="/terms" className="hover:text-neutral-300 transition">
              Terms of Service
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="text-rose-400 font-semibold">
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
