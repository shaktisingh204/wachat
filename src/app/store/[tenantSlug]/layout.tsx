import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getStorefrontHome } from '@/app/actions/storefront.actions';
import './storefront.css';

export const dynamic = 'force-dynamic';

interface StorefrontHead {
    displayName: string;
    slug: string;
    customCss?: string;
    logoUrl?: string;
    faviconUrl?: string;
}

interface ThemeDoc {
    configJson?: { primary?: string; font?: string; background?: string; foreground?: string };
}

export default async function StorefrontLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantSlug: string }>;
}) {
    const { tenantSlug } = await params;
    const res = await getStorefrontHome(tenantSlug);
    if (!res.ok) notFound();
    const sf = res.storefront as StorefrontHead;
    const theme = (res.theme as ThemeDoc | undefined)?.configJson ?? {};

    const cssVars = {
        ['--store-primary' as string]: theme.primary ?? '#5b21b6',
        ['--store-bg' as string]: theme.background ?? '#ffffff',
        ['--store-fg' as string]: theme.foreground ?? '#0f172a',
        ['--store-font' as string]: theme.font ?? 'system-ui, sans-serif',
    } as React.CSSProperties;

    return (
        <div className="storefront" style={cssVars}>
            {sf.customCss ? <style dangerouslySetInnerHTML={{ __html: sf.customCss }} /> : null}
            <header className="storefront-header">
                <div className="storefront-container flex items-center justify-between gap-4 py-4">
                    <Link href={`/store/${sf.slug}`} className="text-lg font-semibold">
                        {sf.logoUrl ? (
                            <img src={sf.logoUrl} alt={sf.displayName} className="h-8" />
                        ) : (
                            sf.displayName
                        )}
                    </Link>
                    <nav className="flex items-center gap-4 text-sm">
                        <Link href={`/store/${sf.slug}`}>Shop</Link>
                        <Link href={`/store/${sf.slug}/cart`}>Cart</Link>
                        <Link href={`/store/${sf.slug}/account/orders`}>Orders</Link>
                    </nav>
                </div>
            </header>
            <main className="storefront-container py-8">{children}</main>
            <footer className="storefront-footer">
                <div className="storefront-container py-6 text-sm opacity-70">
                    © {new Date().getFullYear()} {sf.displayName}
                </div>
            </footer>
        </div>
    );
}
