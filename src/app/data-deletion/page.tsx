import Link from 'next/link'
import { ArrowLeft, Trash2, Mail, ShieldCheck, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const metadata = {
  title: 'User Data Deletion Instructions | Vipee',
  description: 'Step-by-step instructions on how to revoke TikTok authorization and request complete deletion of your data from Vipee.',
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-rose-500/30 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
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

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono">
            <Trash2 className="w-3.5 h-3.5" />
            User Privacy &amp; Data Rights
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            User Data Deletion Instructions
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            In compliance with the TikTok Platform Developer Terms, GDPR Article 17, and global data privacy standards, Vipee provides simple and transparent ways for creators to revoke permissions and delete all associated account information.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-6">
          {/* Method 1 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-base font-bold text-white">
                Instant Revocation via TikTok Mobile App (Recommended)
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              You can instantly revoke Vipee&apos;s access to your TikTok account at any time directly through your TikTok privacy settings:
            </p>
            <ol className="text-xs md:text-sm text-neutral-300 space-y-2 list-decimal list-inside pl-2">
              <li>Open the <strong className="text-white">TikTok</strong> app on your mobile device.</li>
              <li>Tap <strong className="text-white">Profile</strong> at the bottom right.</li>
              <li>Tap the <strong className="text-white">Menu</strong> icon (3 horizontal lines) at the top right and select <strong className="text-white">Settings and privacy</strong>.</li>
              <li>Tap <strong className="text-white">Security &amp; permissions</strong>, then select <strong className="text-white">Manage app permissions</strong>.</li>
              <li>Find and tap on <strong className="text-white">Vipee</strong> in the list of authorized apps.</li>
              <li>Tap <strong className="text-rose-400 font-semibold">Remove access</strong> and confirm.</li>
            </ol>
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-400 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Once access is removed, all active OAuth tokens held by Vipee are instantly invalidated by TikTok. Our servers will no longer have access to your account profile or posting APIs.
              </span>
            </div>
          </div>

          {/* Method 2 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="text-base font-bold text-white">
                Request Complete Server Data Erasure via Email
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              If you want all historical session records, diagnostic logs, and uploaded temporary media files wiped permanently from our database:
            </p>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs md:text-sm">
              <div className="flex items-center gap-2 text-neutral-300">
                <Mail className="w-4 h-4 text-rose-400" />
                <span>Send an email to: <strong className="text-white font-mono">privacy@vipee.io</strong></span>
              </div>
              <div className="text-neutral-400 text-xs pl-6">
                Subject line: <span className="text-neutral-200 font-mono">Data Deletion Request - [Your TikTok Username or OpenID]</span>
              </div>
            </div>
            <p className="text-xs text-neutral-400">
              Our Data Protection Officer will verify your request and permanently purge all stored data within <strong className="text-white">48 hours</strong>. You will receive an email confirmation once the erasure is complete.
            </p>
          </div>

          {/* What data is deleted */}
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" />
              What Data is Deleted Upon Request?
            </h3>
            <ul className="text-xs md:text-sm text-neutral-300 space-y-1.5 list-disc list-inside">
              <li>All OAuth access and refresh tokens.</li>
              <li>Cached user profile data (display name, avatar URL, OpenID).</li>
              <li>Generated video project drafts, storyboards, and audio synthesis files.</li>
              <li>Temporary upload logs associated with your account identifier.</li>
            </ul>
          </div>
        </div>

        {/* Support Contact */}
        <div className="pt-6 border-t border-neutral-800 text-xs text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Need help? Contact our privacy team at{' '}
            <a href="mailto:privacy@vipee.io" className="text-rose-400 hover:underline font-mono">
              privacy@vipee.io
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-white transition">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-white transition">
              Terms of Service
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
