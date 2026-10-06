export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 max-w-3xl mx-auto space-y-6 font-sans">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-neutral-400">Last updated: October 2026</p>
      <div className="space-y-4 text-sm text-neutral-300 leading-relaxed">
        <p>
          Welcome to Vipee. By using our application, you agree to comply with and be bound by the following terms and conditions of use.
        </p>
        <h2 className="text-lg font-semibold text-white">1. Service Description</h2>
        <p>
          Vipee is a content workflow tool that enables authorized TikTok creators to direct post and manage video content via official TikTok developer APIs.
        </p>
        <h2 className="text-lg font-semibold text-white">2. User Accounts & TikTok Authorization</h2>
        <p>
          Access requires authorization via official TikTok Login Kit. We do not store or solicit your TikTok password.
        </p>
      </div>
    </div>
  )
}
