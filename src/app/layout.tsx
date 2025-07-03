import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { PT_Sans } from 'next/font/google';

export const metadata: Metadata = {
  title: 'SabNode',
  description: 'Your All-in-One Business Communication Platform',
};

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-pt-sans',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={ptSans.variable}>
      <head />
      <body className="font-body antialiased px-4 sm:px-6 lg:px-8">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
