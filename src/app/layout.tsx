import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BoardThemeProvider } from "@/components/board/theme";
import { ServiceWorker } from "@/components/service-worker";
import { UpdateNotice } from "@/components/update-notice";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BnB Board",
  description: "Stays and to-dos across the properties",
  applicationName: "BnB Board",
  appleWebApp: { capable: true, title: "BnB Board", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Draw under the notch and home indicator; globals.css pads by the safe-area insets
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.972 0.006 235)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.165 0.012 250)" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <body>
        <BoardThemeProvider>
          {children}
          <ServiceWorker />
          <UpdateNotice />
          <Toaster
            position="bottom-center"
            toastOptions={{
              classNames: {
                toast: "cn-toast text-base!",
                // Undo and Refresh are tapped on phones: keep them at least 44px tall
                actionButton: "h-11! px-4! text-base!",
                cancelButton: "h-11! px-4! text-base!",
              },
            }}
          />
        </BoardThemeProvider>
      </body>
    </html>
  );
}
