import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { HydrationProvider } from "@/components/HydrationProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SNJ Pinterest — Wholesale Jewelry Discovery",
  description:
    "Discover and curate jewelry trends from across the web. Swipe, save, and organize products into client buckets.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SNJ",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#14110f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <HydrationProvider>
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col pb-24">
            {children}
          </div>
          <BottomNav />
        </HydrationProvider>
      </body>
    </html>
  );
}
