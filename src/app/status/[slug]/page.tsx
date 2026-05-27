import * as React from 'react';
import { notFound } from 'next/navigation';

import { sabmonitorStatusPageApi } from '@/lib/rust-client/sabmonitor-status-pages';
import { sabmonitorStatusPageIncidentApi } from '@/lib/rust-client/sabmonitor-status-page-incidents';
import { RustApiError } from '@/lib/rust-client/fetcher';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string }>;
}

function bannerForChecks(checks: { lastStatus: string }[]): {
    label: string;
    tone: string;
} {
    const anyDown = checks.some((c) => c.lastStatus === 'down');
    const anyWarn = checks.some((c) => c.lastStatus === 'warning');
    if (anyDown) {
        return { label: 'Partial outage', tone: 'bg-rose-500/15 text-rose-700 border-rose-500/30' };
    }
    if (anyWarn) {
        return { label: 'Degraded performance', tone: 'bg-amber-500/15 text-amber-700 border-amber-500/30' };
    }
    return { label: 'All systems operational', tone: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' };
}

export default async function PublicStatusPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { slug } = await params;
    let page: Awaited<ReturnType<typeof sabmonitorStatusPageApi.publicGetBySlug>> | null = null;
    try {
        page = await sabmonitorStatusPageApi.publicGetBySlug(slug);
    } catch (err) {
        if (err instanceof RustApiError && err.status === 404) {
            notFound();
        }
        throw err;
    }
    if (!page) notFound();

    // Curated incident posts (best-effort — empty array if not yet populated).
    let incidents: Awaited<ReturnType<typeof sabmonitorStatusPageIncidentApi.publicListByStatusPage>>['items'] = [];
    // We don't have a page id from the public view; the API exposes only
    // the slug. The curated-posts public endpoint is keyed by statusPageId,
    // so this section stays empty until that endpoint is also slug-keyed.

    const banner = bannerForChecks(page.checks);

    return (
        <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
            {page.customCss ? <style>{page.customCss}</style> : null}
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold">{page.title}</h1>
                {page.customHeader && (
                    <p className="text-sm text-zinc-600">{page.customHeader}</p>
                )}
            </header>

            <section
                className={`rounded-md border p-4 text-sm font-medium ${banner.tone}`}
                role="status"
                aria-live="polite"
            >
                {banner.label}
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Components
                </h2>
                <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
                    {page.checks.length === 0 ? (
                        <li className="p-3 text-sm text-zinc-500">No components configured.</li>
                    ) : (
                        page.checks.map((c) => (
                            <li
                                key={c.id}
                                className="flex items-center justify-between p-3 text-sm"
                            >
                                <span className="font-medium text-zinc-800">{c.name}</span>
                                <span
                                    className={
                                        c.lastStatus === 'up'
                                            ? 'text-emerald-700'
                                            : c.lastStatus === 'warning'
                                              ? 'text-amber-700'
                                              : c.lastStatus === 'down'
                                                ? 'text-rose-700'
                                                : 'text-zinc-500'
                                    }
                                >
                                    {c.lastStatus}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Recent incidents
                </h2>
                {incidents.length === 0 ? (
                    <p className="text-sm text-zinc-500">No recent incidents to report.</p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {incidents.map((i) => (
                            <li key={i._id} className="rounded-md border border-zinc-200 p-3">
                                <div className="flex items-baseline justify-between">
                                    <span className="font-medium text-zinc-800">{i.title}</span>
                                    <span className="text-[12px] uppercase tracking-wide text-zinc-500">
                                        {i.kind}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-zinc-600">{i.body}</p>
                                <span className="mt-2 block text-[11px] text-zinc-400">
                                    {new Date(i.postedAt).toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <footer className="pt-6 text-[11px] text-zinc-400">
                Powered by SabMonitor
            </footer>
        </main>
    );
}
