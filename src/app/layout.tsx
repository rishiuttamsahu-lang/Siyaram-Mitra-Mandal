/* eslint-disable @next/next/no-page-custom-font */

import type { Metadata, Viewport } from "next";
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

const metadataBaseUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://siyaram-mitra-mandal.vercel.app");
  } catch {
    return new URL("https://siyaram-mitra-mandal.vercel.app");
  }
})();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: "Siyaram Mitra Mandal | Shanti Sagar Cha Maharaja",
  
  // 🚀 Perfect Length SEO Description (158 Characters - Won't cut off on Google)
  description: "Official portal of Siyaram Mitra Mandal, Bhiwandi. Securely track monthly chanda contributions, explore exclusive Bappa photos, and connect with our Parivar.",
  
  keywords: [
    "Siyaram Mitra Mandal",
    "Siyaram Mitra Mandal Bhiwandi",
    "Ganpati Mandal Bhiwandi",
    "Bappa Photos and Gallery",
    "Ganeshotsav Celebration",
    "Mandal Chanda Tracker",
    "Siyaram Mandal Parivar",
    "Online Mandal Contribution",
    "Ganesh Chaturthi Mandal",
    "Mandal Seva Portal",
    "Bhiwandi Ganeshotsav",
    "Mitra Mandal App",
    "Siyaram",
    "Siyaram Mitra",
    "Siyaram Mandal"
  ],
  authors: [{ name: "Siyaram Mitra Mandal" }],
  
  openGraph: {
    title: "Siyaram Mitra Mandal Bhiwandi | Shanti Sagar Cha Maharaja",
    // 🚀 Longer Description for WhatsApp, Facebook, and Instagram link previews
    description: "Welcome to the official Siyaram Mitra Mandal digital portal. Experience our exclusive 3D gallery vault, track real-time monthly seva, and join the Ganeshotsav celebrations safely.",
    url: metadataBaseUrl.href,
    siteName: "Siyaram Mitra Mandal",
    images: [
      {
        url: metadataBaseUrl.origin + "/logo.png",
        width: 800,
        height: 600,
        alt: "Siyaram Mitra Mandal Logo",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#5A0000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Gotu&family=Poppins:wght@700;900&family=Rozha+One&display=swap"
          rel="stylesheet"
        />
        <meta name="google-site-verification" content="8qtmD0p7C0NyIPpXQpFyeO-w_TzzLnLPycMB66SB40M" />
        <meta name="msvalidate.01" content="52C2C02AE9C5F23CD3542A219B24CA3F" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="canonical" href={metadataBaseUrl.href} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Siyaram Mitra Mandal",
  "url": "${metadataBaseUrl.href}",
  "logo": "${metadataBaseUrl.origin}/logo.png",
  "sameAs": []
}` }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Siyaram Mitra Mandal",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Bhiwandi",
    "addressRegion": "Maharashtra",
    "addressCountry": "IN"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": "", "longitude": "" },
  "url": "${metadataBaseUrl.href}"
}` }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
