'use client';

/**
 * Wachat WhatsApp Ads Setup — deprecated wizard entry point.
 *
 * The actual setup flow now lives at /dashboard/facebook/all-projects.
 * We render a ZoruUI redirect notice with an in-page numbered step
 * list (no tab UI) of the canonical wizard steps so the link target
 * retains structural parity with the spec.
 */

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';

const STEPS = [
  {
    id: 'connect',
    label: 'Connect Meta',
    description:
      'Authorize SabNode to manage your Facebook business assets and ad accounts.',
  },
  {
    id: 'select-page',
    label: 'Select Page',
    description:
      'Pick the Facebook Page that owns your WhatsApp business profile.',
  },
  {
    id: 'ad-account',
    label: 'Ad Account',
    description:
      'Choose the ad account that will fund click-to-WhatsApp campaigns.',
  },
  {
    id: 'review',
    label: 'Review & Launch',
    description:
      'Confirm your selections and start your first click-to-WhatsApp campaign.',
  },
] as const;

export default function DeprecatedWhatsappAdsSetupPage() {
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.replace('/dashboard/facebook/all-projects');
    }, 1500);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <div className="flex items-center gap-3 text-[13px] text-zoru-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting you to the new project connections page…
      </div>

      <ZoruCard className="p-6">
        <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink">
          WhatsApp Ads Setup
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[13px] text-zoru-ink-muted">
          Click-to-WhatsApp campaigns are now configured in the dedicated Ads
          Manager. Here&apos;s the four-step flow you&apos;ll see there.
        </p>

        <ol className="mt-6 flex flex-col gap-3">
          {STEPS.map((step, idx) => (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zoru-ink text-[11px] text-zoru-on-primary">
                {idx + 1}
              </span>
              <div className="flex-1">
                <h3 className="text-[14px] text-zoru-ink">{step.label}</h3>
                <p className="mt-1 text-[13px] text-zoru-ink-muted">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </ZoruCard>
    </div>
  );
}
