import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { StreamProvider } from "@/providers/stream-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { JellyfinLibraryProvider } from "@/contexts/jellyfin-library-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://nemo.laubier.online";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Nemo — Streaming sans limites",
    template: "%s | Nemo",
  },
  description:
    "Découvrez des millions de films et séries. Streaming 4K, VF & VOSTFR, propulsé par TMDb.",
  keywords: ["streaming", "films", "séries", "4K", "VF", "VOSTFR"],
  authors: [{ name: "Nemo" }],
  creator: "Nemo",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: appUrl,
    siteName: "Nemo",
    title: "Nemo — Streaming sans limites",
    description:
      "Découvrez des millions de films et séries. Streaming 4K, VF & VOSTFR, propulsé par TMDb.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nemo — Streaming sans limites",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nemo — Streaming sans limites",
    description: "Découvrez des millions de films et séries. Streaming 4K, VF & VOSTFR.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon",
  },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <QueryProvider>
          <AuthProvider>
            <JellyfinLibraryProvider>
              <StreamProvider>
                {children}
              </StreamProvider>
            </JellyfinLibraryProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
