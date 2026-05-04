'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect the base /dashboard/calls route to the default logs tab.
// Uses router.replace() in an effect instead of redirect() — redirect() is
// for Server Components/Route Handlers; calling it in useEffect of a Client
// Component throws an error.
export default function CallsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/calls/logs');
  }, [router]);
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      Redirecting to call logs...
    </div>
  );
}
