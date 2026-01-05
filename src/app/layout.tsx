import type { Metadata } from "next";
import { Geist, Geist_Mono, Quicksand } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/site/navbar";
import PrefetchRoutes from "@/components/site/PrefetchRoutes";
import { ThemeProvider } from "@/components/theme/theme-provider";
import Footer from "@/components/site/footer";
import { Toaster } from "@/components/system/toaster";
import "@/styles/theme.css";
import Script from "next/script";
import { CustomizationProvider } from "@/components/providers/customization-provider";
import { brand } from "@/config/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Quicksand({
  variable: "--font-display",
  subsets: ["latin"],
});

const defaultTitle = `${brand.name} - ${brand.tagline}`;

export const metadata: Metadata = {
  title: {
    default: defaultTitle,
    template: `%s | ${brand.name}`,
  },
  description: brand.blurb,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/linket-favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/linket-favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "/",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title: defaultTitle,
    description: brand.blurb,
    url: "/",
    siteName: brand.name,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${brand.name} preview`,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.blurb,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${brand.name} NFC Keychain`,
    description: brand.blurb,
    image: `${siteUrl}/og.png`,
    brand: {
      "@type": "Brand",
      name: brand.name,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "19.00",
      availability: "https://schema.org/InStock",
      url: siteUrl,
    },
  };
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider initial="light" storageKey={null}>
          <PrefetchRoutes />
          <CustomizationProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
            >
              Skip to content
            </a>
            <div className="flex min-h-dvh flex-col">
              <Navbar />
              <main id="main" className="flex-1 min-h-0">
                {children}
              </main>
              <Footer />
            </div>
            <Script
              id="product-jsonld"
              type="application/ld+json"
              strategy="afterInteractive"
            >
              {JSON.stringify(productJsonLd)}
            </Script>
            <Toaster />
          </CustomizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
