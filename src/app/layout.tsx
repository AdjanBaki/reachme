import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
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
  title: { default: "ReachMe", template: "%s · ReachMe" },
  description: "Hitta kunder som redan letar efter dig",
};

function Logo() {
  return (
    <Link href="/leads" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-sm text-accent-foreground">
        R
      </span>
      ReachMe
    </Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="md:flex md:min-h-screen">
          {/* Sidebar on tablets and up */}
          <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-border bg-surface px-3 py-5 md:flex">
            <div className="px-3">
              <Logo />
            </div>
            <AppNav orientation="vertical" />
            <div className="mt-auto px-3 text-xs text-muted">
              <Link href="/kom-igang" className="hover:text-foreground hover:underline">
                Kom igång
              </Link>
              <p className="mt-2">Exempeldata, inga tjänster är inkopplade än.</p>
            </div>
          </aside>

          {/* Top bar on phones */}
          <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 pt-3 pb-2 backdrop-blur md:hidden">
            <div className="mb-2">
              <Logo />
            </div>
            <AppNav orientation="horizontal" />
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-4xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
