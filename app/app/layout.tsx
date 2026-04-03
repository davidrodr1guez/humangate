import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HumanGate",
  description: "Proof-of-humanity for AI agents via World ID",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
