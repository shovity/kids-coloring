import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import RemoveOldSW from "@/components/RemoveOldSW";
import "./globals.css";

const font = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "800"] });

export const metadata: Metadata = {
  title: "Bé Tô Màu",
  description: "Trò chơi tô màu cho bé",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bé Tô Màu", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#38b6e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={font.className}>
        {children}
        <RotateHint />
        <RemoveOldSW />
      </body>
    </html>
  );
}

function RotateHint() {
  return (
    <div className="rotate-hint" aria-hidden>
      <div className="rotate-phone" />
      <p>Xoay ngang máy để chơi nhé!</p>
    </div>
  );
}
