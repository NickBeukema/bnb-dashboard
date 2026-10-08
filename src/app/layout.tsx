import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BoardThemeProvider } from "@/components/board/theme";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BnB Board",
  description: "Stays and to-dos across the properties",
};

export const viewport: Viewport = {
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
          <Toaster position="bottom-center" toastOptions={{ classNames: { toast: "cn-toast text-base!" } }} />
        </BoardThemeProvider>
      </body>
    </html>
  );
}
