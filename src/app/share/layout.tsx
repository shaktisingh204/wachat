/**
 * Public share layout — wraps every page under `/share/*`.
 *
 * - No auth middleware: pages here are hash-signed public endpoints.
 * - Header pulls company branding (logo + name) from the `companies`
 *   collection. If no record exists, falls back to a SabNode default
 *   so the layout never crashes for a stale tenant.
 * - Footer is plain and unbranded — designed for embedding in
 *   customer-facing emails / portals.
 */

import 'server-only';
import * as React from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { connectToDatabase } from '@/lib/mongodb';
import { headers } from 'next/headers';

type CompanyBrand = {
  name: string;
  logo: string | null;
  address: string | null;
};

async function loadCompanyBrand(): Promise<CompanyBrand> {
  try {
    const { db } = await connectToDatabase();
    
    let query: any = {};
    const headersList = await headers();
    const hostHeader = headersList.get('host');
    
    if (hostHeader) {
      const cleanHost = hostHeader.split(':')[0];
      const isCanonical = [
        'sabnode.com',
        'vercel.app',
        'localhost',
        '127.0.0.1',
      ].some(
        (suffix) => cleanHost === suffix || cleanHost.endsWith(`.${suffix}`)
      );
      
      if (!isCanonical) {
        query = {
          $or: [
            { customDomain: cleanHost },
            { domain: cleanHost },
            { 'settings.customDomain': cleanHost },
            { 'settings.domain': cleanHost },
          ],
        };
      }
    }

    let company = null;
    if (Object.keys(query).length > 0) {
      company = await db.collection('companies').findOne(query);
    }
    
    if (!company) {
      company = await db
        .collection('companies')
        .findOne({}, { sort: { createdAt: 1 } });
    }

    if (!company) {
      return { name: 'SabNode', logo: null, address: null };
    }
    return {
      name: (company.companyName as string) || (company.name as string) || 'SabNode',
      logo: (company.companyLogo as string) || (company.logo as string) || null,
      address: (company.companyAddress as string) || (company.address as string) || null,
    };
  } catch {
    return { name: 'SabNode', logo: null, address: null };
  }
}

async function BrandHeader() {
  const brand = await loadCompanyBrand();
  return (
    <header className="border-b border-[var(--st-border)] bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={`${brand.name} logo`}
            width={40}
            height={40}
            className="h-10 w-10 rounded-md object-contain"
            unoptimized
          />
        ) : (
          <div
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-md bg-[var(--st-text)] text-sm font-semibold text-white"
          >
            {brand.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{brand.name}</div>
          {brand.address ? (
            <div className="truncate text-xs text-[var(--st-text)]">{brand.address}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

async function BrandFooter() {
  const brand = await loadCompanyBrand();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-[var(--st-border)] bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-[var(--st-text)] sm:flex-row">
        <span>
          &copy; {year} {brand.name}. All rights reserved.
        </span>
        <span>Powered by SabNode</span>
      </div>
    </footer>
  );
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--st-bg-muted)] text-[var(--st-text)] antialiased">
      <React.Suspense fallback={<div className="h-[73px] border-b border-[var(--st-border)] bg-white" />}>
        <BrandHeader />
      </React.Suspense>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <React.Suspense fallback={<div className="h-[53px] border-t border-[var(--st-border)] bg-white" />}>
        <BrandFooter />
      </React.Suspense>
    </div>
  );
}
