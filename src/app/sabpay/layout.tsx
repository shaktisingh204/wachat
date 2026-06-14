export const dynamic = 'force-dynamic';

import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { getCachedSession } from '@/lib/server-cache';
import { ToastProvider, Toaster } from '@/components/sabcrm/20ui';
import { getMyKyc } from '@/app/actions/sabpay-kyc.actions';

import { SabpayShell } from './_components/sabpay-shell';

/**
 * SabPay layout — session-guarded shell around every /sabpay page.
 * SabPay is user-scoped (the merchant IS the SabNode user), so unlike
 * WaChat there is no project picker / ProjectProvider here.
 */
export default async function SabpayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect('/login');
  }

  /* ── SabPay onboarding gate ──────────────────────────────────────────
   * Every merchant must complete KYC onboarding (business details + bank +
   * documents) before using SabPay — like a real payment gateway. The
   * onboarding wizard at /sabpay/onboarding is always allowed through. */
  const pathname = (await headers()).get('x-url') ?? '';
  const onOnboarding =
    pathname === '/sabpay/onboarding' || pathname.startsWith('/sabpay/onboarding/');
  if (pathname && !onOnboarding) {
    const kyc = await getMyKyc();
    if (kyc?.status !== 'verified') {
      redirect('/sabpay/onboarding');
    }
  }

  const user = session.user as {
    name?: string;
    email?: string;
    image?: string;
    plan?: { name?: string };
    credits?: number | Record<string, number>;
  };

  const credits = user?.credits;
  const totalCredits =
    typeof credits === 'number'
      ? credits
      : credits && typeof credits === 'object'
        ? Object.values(credits).reduce(
            (sum, v) => sum + (typeof v === 'number' ? v : 0),
            0,
          )
        : 0;

  // Onboarding renders standalone (no dashboard shell — the merchant isn't
  // active yet).
  if (onOnboarding) {
    return (
      <ToastProvider>
        {children}
        <Toaster />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <SabpayShell
        user={{ name: user?.name, email: user?.email, avatar: user?.image }}
        plan={{ name: user?.plan?.name, credits: totalCredits }}
      >
        {children}
      </SabpayShell>
      <Toaster />
    </ToastProvider>
  );
}
