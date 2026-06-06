import { TooltipProvider } from '@/components/sabcrm/20ui/compat';
// Legacy ZoruUI Sonner toaster (self-contained) kept for files still on ZoruUI;
// migrated files use the 20ui ToastProvider/Toaster mounted below.
import { ZoruToaster as Toaster } from '@/components/sabcrm/20ui/compat';import { Plus_Jakarta_Sans,
  Geist,
  Geist_Mono,
  Hanken_Grotesk,
  Onest } from 'next/font/google';

import "@/react-shim";
import type { Metadata, Viewport } from 'next';
import './globals.css';
// ui20 design tokens promoted to :root so `var(--st-*)`/`var(--u-*)` resolve
// app-wide (enables the central-token migration outside the CRM/HRM surfaces).
import '@/components/sabcrm/20ui/tokens-global.css';

import SessionProvider from '@/components/zoruui-domain/session-provider';
import { MotionProvider } from '@/components/motion';
// 20ui toast system, mounted app-wide so migrated files' useToast() has a
// provider (coexists with the ZoruUI Toaster during the migration).
import { ToastProvider as Ui20ToastProvider, Toaster as Ui20Toaster } from '@/components/sabcrm/20ui';

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

// Display face for marketing — tight geometric grotesk, variable + italic.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sab-display',
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
});

// Body / UI text — clean modern reading font, pairs with Hanken.
const onest = Onest({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sab-body',
  weight: ['300', '400', '500', '600', '700'],
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
      className={`${plusJakartaSans.variable} ${geistSans.variable} ${geistMono.variable} ${hankenGrotesk.variable} ${onest.variable}`}
    >
      <body className="antialiased font-sans min-h-screen bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
        {/* Theme bootstrap — resolve the saved light/dark preference and stamp
            an explicit class on <html> BEFORE first paint, so the app rail,
            header, and every ZoruUI / 20ui surface render in the chosen theme
            with no flash. "system" is resolved to an explicit class so the
            20ui prefers-color-scheme fallback can't override the choice. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('sabnode-theme')||'system';var d=document.documentElement;d.classList.remove('light','dark');var dark=t==='dark'||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.add(dark?'dark':'light');}catch(e){}})();",
          }}
        />
        <MotionProvider>
          <SessionProvider>
            <TooltipProvider>
              <Ui20ToastProvider>
                {children}
                <Ui20Toaster />
              </Ui20ToastProvider>
            </TooltipProvider>
          </SessionProvider>
          <Toaster />
        </MotionProvider>
      </body>
    </html>
  );
}
