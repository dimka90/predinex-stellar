import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletAdapterProvider } from "./components/WalletAdapterProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { ThemeProvider } from "./context/ThemeContext";
import Footer from "./components/Footer";
import MarketListPreloader from "./components/MarketListPreloader";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <WalletAdapterProvider>
            <ToastProvider>
              <MarketListPreloader />
              {children}
              <Footer />
            </ToastProvider>
          </WalletAdapterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
