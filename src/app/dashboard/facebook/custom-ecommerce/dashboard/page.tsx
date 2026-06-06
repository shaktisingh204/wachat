"use client";

import { Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/**
 * /dashboard/facebook/custom-ecommerce/dashboard
 *
 * Legacy entry point — preserved as a redirect to the canonical shop list
 * (the new account-level overview lives at the parent route). Restyled
 * with neutral zoru tokens.
 */

export default function CustomEcommerceDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/facebook/custom-ecommerce");
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col items-center justify-center gap-3 px-6 pt-24 pb-10">
      <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
      <p className="text-[13px] text-[var(--st-text-secondary)]">
        Redirecting to your shops…
      </p>
      <Skeleton className="h-4 w-40" />
    </div>
  );
}
