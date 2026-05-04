"use client";

/**
 * Local zoru replacement for `@/components/wabasimplify/feature-lock`.
 *
 * Same FeatureLock + FeatureLockOverlay API, but renders zoru atoms only.
 */

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { ZoruButton } from "@/components/zoruui";

export function FeatureLock({
  isAllowed,
  children,
}: {
  isAllowed: boolean;
  children: React.ReactNode;
}) {
  if (isAllowed) return <>{children}</>;
  return (
    <div className="relative pointer-events-none opacity-60 blur-[1px]">
      {children}
    </div>
  );
}

export function FeatureLockOverlay({
  isAllowed,
  featureName,
}: {
  isAllowed: boolean;
  featureName: string;
}) {
  if (isAllowed) return null;
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[var(--zoru-radius-lg)] bg-zoru-bg/80 p-6 text-center backdrop-blur-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
        <Lock className="h-5 w-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-zoru-ink">
          &lsquo;{featureName}&rsquo; is a premium feature
        </h3>
        <p className="text-sm text-zoru-ink-muted">
          This feature is not included in your current plan.
        </p>
      </div>
      <ZoruButton asChild>
        <Link href="/dashboard/user/billing#upgrade">Upgrade plan</Link>
      </ZoruButton>
    </div>
  );
}
