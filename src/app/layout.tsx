import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://affapp-teal.vercel.app'),
  title: "Vipee - AI Video Studio for TikTok & TikTok Shop",
  description: "Automated TikTok Direct Post & AI-powered eCommerce Video Creation Platform",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/vipee-icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/vipee-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "Vipee - AI Video Studio for TikTok & TikTok Shop",
    description: "Automated TikTok Direct Post & AI-powered eCommerce Video Creation Platform",
    images: [{ url: '/vipee-icon-512.png', width: 512, height: 512, alt: 'Vipee Logo' }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
