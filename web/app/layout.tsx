import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletAdapterProvider } from "./components/WalletAdapterProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { ThemeProvider, ThemeInitScript } from "../lib/theme";
import { I18nProvider } from "./providers/I18nProvider";
import Footer from "./components/Footer";
import MarketListPreloader from "./components/MarketListPreloader";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Predinex | Next-Gen Prediction Markets on Stellar",
  description: "The decentralized prediction market built on Stellar. Predict, bet, and win with Soroban-powered smart contracts.",
  openGraph: {
    title: "Predinex | Next-Gen Prediction Markets on Stellar",
    description: "The decentralized prediction market built on Stellar. Predict, bet, and win with Soroban-powered smart contracts.",
    url: "https://predinex.io",
    siteName: "Predinex",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Predinex - Prediction Markets on Stellar",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Predinex | Next-Gen Prediction Markets on Stellar",
    description: "Predict the future. Win on Stellar.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Predinex",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <I18nProvider>
            <WalletAdapterProvider>
              <ToastProvider>
                <ServiceWorkerRegistration />
                <MarketListPreloader />
                {children}
                <Footer />
                <PWAInstallPrompt />
              </ToastProvider>
            </WalletAdapterProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
