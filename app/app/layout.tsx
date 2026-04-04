import type { Metadata } from "next";
import Link from "next/link";
import { MouseGlow } from "./mouse-glow";
import "./globals.css";

export const metadata: Metadata = {
  title: "HumanGate — The Open Standard for Human-Backed AI Agents",
  description:
    "A shared on-chain whitelist that any service can query. Verify once with World ID, operate forever.",
};

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
        fill="url(#shield-fill)"
        stroke="url(#shield-stroke)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shield-fill" x1="3" y1="2" x2="21" y2="24">
          <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
          <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
        </linearGradient>
        <linearGradient id="shield-stroke" x1="3" y1="2" x2="21" y2="24">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-white/40 transition-colors duration-200 hover:text-white/80"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-0 text-white antialiased noise-overlay">
        {/* Navigation */}
        <nav className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-surface-0/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <ShieldIcon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-base font-bold tracking-tight text-white">
                HumanGate
              </span>
            </Link>

            <div className="flex items-center gap-8">
              <NavLink href="/demo">Demo</NavLink>
              <NavLink href="/widget">Verify</NavLink>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <Link
                href="/widget"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent-light transition-all duration-200 hover:bg-accent/20 hover:border-accent/30"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-3.5 w-3.5"
                >
                  <path
                    d="M8 1L2 4.5v3.5c0 3.7 2.56 7.16 6 8 3.44-.84 6-4.3 6-8V4.5L8 1z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 8l1.5 1.5L10.5 6"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Get Pass
              </Link>
            </div>
          </div>
        </nav>

        <MouseGlow />
        {/* Main content with top padding for fixed nav */}
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
