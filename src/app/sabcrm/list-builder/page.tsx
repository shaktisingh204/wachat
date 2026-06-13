'use client';

/**
 * SabCRM — List Builder (`/sabcrm/list-builder`).
 *
 * Client entry for the agentic NL list-building surface. Loads the project's
 * objects (`listObjectsTw`) to populate the object selector, then hands off to
 * {@link ListBuilderClient} which runs the metered `nlBuildListTw` action and
 * renders the parsed filter + matching records.
 *
 * Mirrors the all-client structure of `/sabcrm/ask` — the active project comes
 * from `useProject` (client context), so data is loaded via gated actions on
 * mount rather than in a server component. Auth / onboarding / RBACGuard are
 * enforced by the parent SabCRM `layout.tsx`; the action re-runs the full gate.
 */

import * as React from 'react';

import { Skeleton, Alert } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import { ListBuilderClient, type ListBuilderObject } from './list-builder-client';

export default function ListBuilderPage(): React.ReactElement {
  const { activeProjectId } = useProject();
  const [objects, setObjects] = React.useState<ListBuilderObject[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setObjects([]);
        return;
      }
      setObjects(
        res.data.map((o) => ({ slug: o.slug, labelPlural: o.labelPlural })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  if (objects === null) {
    return (
      <div className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error && objects.length === 0) {
    return (
      <div className="p-[var(--st-space-4)]">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  return <ListBuilderClient objects={objects} />;
}
