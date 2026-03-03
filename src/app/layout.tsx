import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "Nemo — Streaming sans limites",
    template: "%s | Nemo",
  },
  description:
    "Découvrez des millions de films et séries. Streaming 4K, VF & VOSTFR, propulsé par TMDb.",
  keywords: ["streaming", "films", "séries", "4K", "VF", "VOSTFR"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Nemo — Streaming sans limites",
    description: "Découvrez des millions de films et séries. Streaming 4K, VF & VOSTFR.",
    siteName: "Nemo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nemo",
    description: "Streaming 4K · VF & VOSTFR · Films & Séries",
  },
  robots: { index: false, follow: false },
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
