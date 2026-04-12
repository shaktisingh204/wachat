'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /dashboard/settings now redirects to /dashboard/settings/general.
 * Settings tabs are individual pages in the sidebar.
 */
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/settings/general');
  }, [router]);
  return null;
}
