import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono, Rajdhani, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title:       "JSG CamSecure",
  description: "Field service operations — camera and security installation",
  manifest:    "/manifest.webmanifest",
  appleWebApp: {
    capable:         true,
    title:           "JSG CamSecure",
    statusBarStyle:  "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon:  [
      { url: "/favicon.ico",        sizes: "any" },
      { url: "/brand/jsg-camsecure-logo.png", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor:          "#0d1b2a",
  width:               "device-width",
  initialScale:        1,
  maximumScale:        1,
  userScalable:        false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} ${rajdhani.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
