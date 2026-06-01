import Link from 'next/link';

import {
  listObjectsAction,
  listRecordsAction,
} from '@/app/actions/sabcrm.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';

export const metadata = {
  title: 'SabCRM',
};

// Record counts are per-request, project-scoped and must never be cached.
export const dynamic = 'force-dynamic';

/**
 * SabCRM overview — the native SabNode entry for the metadata-driven CRM.
 *
 * Replaces the previous embedded-engine iframe/fallback with a first-party
 * ZoruUI surface: every object the active project can see (standard +
 * custom) is rendered as a card linking to `/sabcrm/<slug>`, decorated with
 * a live record count.
 *
 * Server Component. Auth / onboarding / RBAC / project context are enforced
 * by `./layout.tsx`; the server actions below independently re-run the full
 * session -> project -> RBAC -> plan gate, so this page fails closed (empty
 * state) for anyone who slips past the layout guard.
 */

/** An object paired with its resolved record count for the active project. */
interface ObjectCard {
  object: ObjectMetadata;
  /** Total records, or `null` when the count could not be resolved. */
  count: number | null;
}

/**
 * Resolve the record total for a single object. We ask for the smallest
 * possible page (the runtime still returns the full `total`) and degrade to
 * `null` rather than throwing if the count is unavailable.
 */
async function resolveCount(slug: string): Promise<number | null> {
  const res = await listRecordsAction({ object: slug, page: 1, pageSize: 1 });
  return res.ok ? res.data.total : null;
}

function formatCount(count: number | null): string {
  if (count === null) return '—';
  return new Intl.NumberFormat().format(count);
}

function countLabel(count: number | null): string {
  if (count === null) return 'Count unavailable';
  if (count === 1) return '1 record';
  return `${formatCount(count)} records`;
}

export default async function SabcrmPage() {
  const objectsRes = await listObjectsAction();

  // Permission / plan / project failures from the gate surface here — render
  // a calm, on-brand empty state instead of crashing the route.
  if (!objectsRes.ok) {
    return (
      <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <EmptyState
          title="SabCRM is unavailable"
          description={objectsRes.error}
        />
      </main>
    );
  }

  const objects = objectsRes.data;

  // Fetch counts in parallel — each call is independently gated and safe.
  const cards: ObjectCard[] = await Promise.all(
    objects.map(async (object) => ({
      object,
      count: await resolveCount(object.slug),
    })),
  );

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Customer relationships</ZoruPageEyebrow>
          <ZoruPageTitle>SabCRM</ZoruPageTitle>
          <ZoruPageDescription>
            Your data, organised by object. Open any object to browse, filter
            and manage its records.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          title="No objects yet"
          description="No CRM objects are available in this project."
        />
      ) : (
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
          {cards.map(({ object, count }) => (
            <li key={object.slug} className="flex">
              <Link
                href={`/sabcrm/${object.slug}`}
                className="block w-full no-underline"
                aria-label={`${object.labelPlural}, ${countLabel(count)}`}
              >
                <Card
                  variant="soft"
                  interactive
                  className="flex h-full flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold text-zoru-ink">
                      {object.labelPlural}
                    </span>
                    <span className="text-base font-semibold tabular-nums text-zoru-ink">
                      {formatCount(count)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-zoru-ink-muted">
                    {object.description ?? countLabel(count)}
                  </p>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Badge variant={object.standard ? 'secondary' : 'info'}>
                      {object.standard ? 'Standard' : 'Custom'}
                    </Badge>
                    <span className="text-xs text-zoru-ink-muted">
                      {countLabel(count)}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
