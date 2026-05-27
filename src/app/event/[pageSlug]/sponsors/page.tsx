/**
 * Public sponsors showcase — `/event/[pageSlug]/sponsors`.
 *
 * Grouped by tier, ordered by `orderRank`. Logo images come from
 * SabFiles via the `/api/sabfiles/[id]` route (TODO: confirm the
 * canonical SabFiles serve URL — the page falls back gracefully to
 * the sponsor name when the logo is missing).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { loadPublicSponsors } from '@/app/actions/sabbackstage-public.actions';
import type { SabbackstageSponsorDoc } from '@/lib/rust-client/sabbackstage-sponsors';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ pageSlug: string }>;
}

function groupByTier(
  sponsors: SabbackstageSponsorDoc[],
): Array<{ tier: string; rows: SabbackstageSponsorDoc[] }> {
  const buckets = new Map<string, SabbackstageSponsorDoc[]>();
  for (const s of sponsors) {
    const arr = buckets.get(s.tier) ?? [];
    arr.push(s);
    buckets.set(s.tier, arr);
  }
  return Array.from(buckets.entries())
    .map(([tier, rows]) => ({
      tier,
      rows: rows.sort((a, b) => a.orderRank - b.orderRank),
    }))
    .sort((a, b) => a.tier.localeCompare(b.tier));
}

export default async function PublicSponsorsPage({ params }: Props) {
  const { pageSlug } = await params;
  const r = await loadPublicSponsors(pageSlug);
  if (!r.ok) notFound();
  const grouped = groupByTier(r.data.sponsors);

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white md:px-12">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/event/${encodeURIComponent(pageSlug)}`}
          className="text-xs underline opacity-70"
        >
          ← Back to event
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Our sponsors</h1>

        {grouped.length === 0 ? (
          <p className="mt-6 text-sm opacity-70">No sponsors yet.</p>
        ) : (
          grouped.map(({ tier, rows }) => (
            <section key={tier} className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider opacity-70">
                {tier}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                {rows.map((s) => (
                  <a
                    key={s._id}
                    href={s.websiteUrl ?? '#'}
                    target={s.websiteUrl ? '_blank' : undefined}
                    rel="noreferrer"
                    className="flex h-28 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    {s.logoFileId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/sabfiles/${s.logoFileId}`}
                        alt={s.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm">{s.name}</span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
