import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BoardThemeProvider } from "@/components/board/theme";
import "./board.css";

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

// A separate root layout keeps this route's Tailwind styles and the classic route's
// global CSS from ever loading on the same page.
export default function BoardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
