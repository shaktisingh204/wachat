import { TooltipProvider } from '@/components/sabcrm/20ui';
import { Plus_Jakarta_Sans,
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

import SessionProvider from '@/components/20ui-domain/session-provider';
import { MotionProvider } from '@/components/motion';
// 20ui toast system, mounted app-wide so migrated files' useToast() has a
// provider (coexists with the Ui20 Toaster during the migration).
import { ToastProvider as Ui20ToastProvider, Toaster as Ui20Toaster } from '@/components/sabcrm/20ui';
// macOS-style desktop: the single persistent host for open app windows. Lives
// here (the only subtree that survives every cross-app navigation) so switching
// apps preserves each app's state. Self-gates to authenticated app routes and
// renders null everywhere else (public/marketing/auth).
import { DesktopHost } from '@/components/sabcrm/20ui/composites/shell/desktop-host';

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
      <body
        suppressHydrationWarning
        className="ui20 20ui antialiased font-sans min-h-screen bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
      >
        {/* Theme bootstrap — resolve the saved light/dark preference and stamp
            an explicit class on <html> AND <body> BEFORE first paint. <body>
            carries the 20ui scope (both the `ui20` and `20ui` class names, so it
            matches the design-system scope whichever rename state is live) so
            every page — not just the shell chrome — gets 20ui component styles
            app-wide. Stamping the explicit light/dark here means the 20ui
            prefers-color-scheme auto-dark fallback can't override the chosen
            theme on a dark-OS machine. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('sabnode-theme')||'system';var dark=t==='dark'||(t==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var theme=dark?'dark':'light';var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(theme);var b=document.body;if(b){b.classList.remove('light','dark');b.classList.add('ui20','20ui',theme);}}catch(e){}})();",
          }}
        />
        <MotionProvider>
          <SessionProvider>
            <TooltipProvider>
              <Ui20ToastProvider>
                {children}
                <Ui20Toaster />
                <DesktopHost />
              </Ui20ToastProvider>
            </TooltipProvider>
          </SessionProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
