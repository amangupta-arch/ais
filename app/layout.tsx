import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono, Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./lumen.css";

// Geist family stays loaded so any not-yet-migrated route keeps its
// existing typography. New / migrated routes use the Lumen family
// (Fraunces serif + DM Sans body + JetBrains Mono numerics).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Resolve the canonical site URL once at module load. Falls back to
// the production domain so social cards / canonical links keep working
// during local dev too. NEXT_PUBLIC_APP_URL is set in Vercel env (and
// .env.example), so production stays in sync if we move domains again.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://myaisetu.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AIS — a daily AI tutor", template: "%s · AIS" },
  description: "Ten minutes a day. Real AI skill, in short conversations with a tutor that remembers you.",
  manifest: "/manifest.webmanifest",
  applicationName: "AIS",
  appleWebApp: { capable: true, title: "AIS", statusBarStyle: "default" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "AIS",
    title: "AIS — a daily AI tutor",
    description: "Ten minutes a day. Real AI skill, in short conversations with a tutor that remembers you.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIS — a daily AI tutor",
    description: "Ten minutes a day. Real AI skill, in short conversations with a tutor that remembers you.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: "/icons/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${dmSans.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      {/* `lm` scopes the Lumen design tokens to the entire app — any
          page can now use lm-* classes. Pages that haven't been
          migrated to Lumen visuals yet still keep their existing
          Tailwind styling (which doesn't reference Lumen tokens). */}
      <body className="lm">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
