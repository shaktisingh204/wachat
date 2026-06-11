import React from 'react';

import { ToastProvider, Toaster } from '@/components/sabcrm/20ui';

/**
 * /dashboard/sabflow layout — adds the 20ui toast context for every SabFlow
 * page. The shell (sidebar + header + dock) comes from the parent /dashboard
 * layout; this layout must never re-wrap SabHomeShell. The Toaster viewport
 * portals to <body> with the ui20 class baked in, so toasts resolve their
 * tokens anywhere.
 */
export default function SabflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
