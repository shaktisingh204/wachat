
import "@/react-shim";
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import SessionProvider from '@/components/wabasimplify/session-provider';

export const metadata: Metadata = {
  title: 'SabNode',
  description: 'Your All-in-One Business Communication and Growth Platform',
};

export const viewport: Viewport = {
  themeColor: 'hsl(var(--background))',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Legacy app-wide font — kept so untouched pages don't shift visually while
// the modern SabUI rolls out across modules.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
});

// SabUI typography — Geist Sans + Geist Mono. Modern, distinctive, pairs
// naturally, used globally by any page that renders sab-ui primitives.
// Available on every page as CSS variables (`--font-sab-sans`, `--font-sab-mono`)
// regardless of which old/new layout that page lives inside.
const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sab-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sab-mono',
  weight: ['400', '500', '600'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased font-sans">
        <SessionProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
