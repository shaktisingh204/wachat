
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Inter } from 'next/font/google';
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

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
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
