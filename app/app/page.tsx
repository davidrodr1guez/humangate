import Link from "next/link";

/* ------------------------------------------------------------------ */
/* SVG Icon Components                                                 */
/* ------------------------------------------------------------------ */

function HeroShield() {
  return (
    <div className="relative mx-auto mb-10 flex items-center justify-center">
      {/* Glow rings */}
      <div className="absolute h-48 w-48 rounded-full border border-accent/10 animate-pulse-ring" />
      <div className="absolute h-36 w-36 rounded-full border border-accent/20 animate-pulse-ring delay-500" />
      <div className="absolute h-56 w-56 rounded-full bg-accent/[0.03] blur-3xl" />

      {/* Shield */}
      <svg
        viewBox="0 0 120 140"
        fill="none"
        className="relative z-10 h-28 w-24 animate-float"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield body */}
        <path
          d="M60 8L12 32v30c0 34 20.4 65.8 48 76 27.6-10.2 48-42 48-76V32L60 8z"
          fill="url(#hero-shield-fill)"
          stroke="url(#hero-shield-stroke)"
          strokeWidth="2"
        />
        {/* Gate bars */}
        <rect x="40" y="50" width="3" height="32" rx="1.5" fill="rgba(255,255,255,0.25)" />
        <rect x="50" y="44" width="3" height="38" rx="1.5" fill="rgba(255,255,255,0.35)" />
        <rect x="59" y="40" width="3" height="42" rx="1.5" fill="rgba(255,255,255,0.45)" />
        <rect x="68" y="44" width="3" height="38" rx="1.5" fill="rgba(255,255,255,0.35)" />
        <rect x="78" y="50" width="3" height="32" rx="1.5" fill="rgba(255,255,255,0.25)" />
        {/* Arch */}
        <path
          d="M36 55 C36 30, 60 22, 60 22 C60 22, 84 30, 84 55"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2"
          fill="none"
        />
        {/* Checkmark circle at top */}
        <circle cx="60" cy="98" r="12" fill="rgba(16, 185, 129, 0.25)" stroke="#10b981" strokeWidth="1.5" />
        <path d="M54 98l4 4 8-8" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="hero-shield-fill" x1="12" y1="8" x2="108" y2="138">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.15)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.06)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0.02)" />
          </linearGradient>
          <linearGradient id="hero-shield-stroke" x1="12" y1="8" x2="108" y2="138">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden sm:flex items-center justify-center text-white/10">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M5 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function FlowStep({
  icon,
  label,
  sublabel,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  delay: string;
}) {
  return (
    <div
      className={`opacity-0 animate-fade-in-up fill-mode-forwards ${delay} flex flex-col items-center gap-3`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="text-xs text-white/30 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

function TrackBadge({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
          <path
            d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="text-[11px] text-white/30">{sublabel}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home Page                                                           */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.04] rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/[0.02] rounded-full blur-[80px]" />

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center px-6 pt-24 pb-16 sm:pt-32 sm:pb-20">
        {/* Shield visual */}
        <div className="opacity-0 animate-fade-in fill-mode-forwards">
          <HeroShield />
        </div>

        {/* Headline */}
        <div className="max-w-2xl text-center">
          <h1 className="opacity-0 animate-fade-in-up fill-mode-forwards delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
            <span className="text-white">Verify once.</span>
            <br />
            <span className="text-gradient">Agent forever.</span>
          </h1>

          <p className="opacity-0 animate-fade-in-up fill-mode-forwards delay-300 mt-6 text-base sm:text-lg text-white/40 max-w-lg mx-auto leading-relaxed">
            The CAPTCHA for human-backed AI agents. Prove humanity with
            World ID, receive a signed pass, and let your agent operate
            autonomously on-chain.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="opacity-0 animate-fade-in-up fill-mode-forwards delay-500 mt-10 flex flex-col sm:flex-row gap-3">
          <Link href="/widget" className="btn-primary px-8 py-3.5 text-sm">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path
                d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M6 8l1.5 1.5L10.5 6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Verify an Agent
          </Link>
          <Link href="/dashboard" className="btn-secondary px-8 py-3.5 text-sm">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Check Status
          </Link>
        </div>
      </section>

      {/* Flow Section */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="opacity-0 animate-fade-in fill-mode-forwards text-center text-xs font-medium uppercase tracking-[0.2em] text-white/20 mb-12">
          How it works
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-4">
          <FlowStep
            delay="delay-200"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white/50">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 20c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            label="Human verifies"
            sublabel="Scan with World App"
          />

          <FlowArrow />

          <FlowStep
            delay="delay-300"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white/50">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
            label="World ID proof"
            sublabel="Zero-knowledge verified"
          />

          <FlowArrow />

          <FlowStep
            delay="delay-400"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-accent">
                <rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Pass issued"
            sublabel="Signed credential + ENS"
          />

          <FlowArrow />

          <FlowStep
            delay="delay-500"
            icon={
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white/50">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Agent operates"
            sublabel="Trusted autonomously"
          />
        </div>
      </section>

      {/* Tracks Section */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="opacity-0 animate-fade-in fill-mode-forwards text-center text-xs font-medium uppercase tracking-[0.2em] text-white/20 mb-8">
          Built for ETHGlobal Cannes 2026
        </p>

        <div className="opacity-0 animate-fade-in-up fill-mode-forwards delay-300 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TrackBadge
            label="World Agent Kit"
            sublabel="Agent verification infrastructure"
          />
          <TrackBadge
            label="World ID 4.0"
            sublabel="Proof-of-humanity protocol"
          />
          <TrackBadge
            label="ENS Integration"
            sublabel="ENSIP-10 wildcard resolver"
          />
        </div>
      </section>

      {/* Bottom tagline */}
      <section className="relative z-10 flex flex-col items-center px-6 py-16 sm:py-20">
        <div className="opacity-0 animate-fade-in fill-mode-forwards h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent mb-10" />
        <p className="text-sm text-white/20 text-center max-w-sm leading-relaxed">
          On-chain verification on World Chain. ENS identity via
          humanbacked.eth. Zero-knowledge proofs preserve privacy.
        </p>
      </section>
    </main>
  );
}
