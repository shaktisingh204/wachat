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
import type { ReactNode } from 'react';
import Image from 'next/image';
import { connectToDatabase } from '@/lib/mongodb';

type CompanyBrand = {
  name: string;
  logo: string | null;
  address: string | null;
};

async function loadCompanyBrand(): Promise<CompanyBrand> {
  try {
    const { db } = await connectToDatabase();
    const company = await db
      .collection('companies')
      .findOne({}, { sort: { createdAt: 1 } });
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

export default async function ShareLayout({ children }: { children: ReactNode }) {
  const brand = await loadCompanyBrand();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <header className="border-b border-zinc-200 bg-white">
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
              className="grid h-10 w-10 place-items-center rounded-md bg-zinc-900 text-sm font-semibold text-white"
            >
              {brand.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">{brand.name}</div>
            {brand.address ? (
              <div className="truncate text-xs text-zinc-500">{brand.address}</div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="mt-auto border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-4 text-xs text-zinc-500 sm:flex-row">
          <span>
            &copy; {year} {brand.name}. All rights reserved.
          </span>
          <span>Powered by SabNode</span>
        </div>
      </footer>
    </div>
  );
}
