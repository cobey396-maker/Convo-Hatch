import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Inter is the fallback for devices without Apple's system font. next/font
// self-hosts it at build time: no request to Google from the user's browser,
// and no layout shift while it loads.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  // Lets the app run full-screen when added to the iPhone home screen.
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // viewport-fit=cover lets content extend under the notch; we then pad it
  // back with env(safe-area-inset-*) (the pt-safe / pb-safe utilities).
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // The browser chrome color follows light/dark mode.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme before React
    // hydrates, so the server HTML and the live DOM differ on purpose.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>
          {/* Vaul scales this wrapper back when a sheet opens (iOS effect). */}
          <div vaul-drawer-wrapper="" className="min-h-dvh bg-bg">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
