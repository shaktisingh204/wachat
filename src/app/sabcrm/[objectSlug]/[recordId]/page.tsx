'use client';

/**
 * SabCRM — Twenty-faithful record DETAIL page (`/sabcrm/[objectSlug]/[recordId]`).
 *
 * A Client Component: the `/sabcrm` layout already enforces auth / onboarding /
 * RBAC and mounts ProjectProvider, and every server action re-runs the full
 * gate, so this page just resolves the active project (via `useProject`), loads
 * the object metadata + the record through the gated Twenty actions, and hands
 * them to the {@link RecordDetailTw} client runtime.
 *
 * The Rust engine may be DOWN: each action returns an `ActionResult`, so a
 * failure renders an inline error/empty state in Twenty's frame rather than
 * crashing or 404-ing the whole route.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Database } from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  getSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import { RecordDetailTw } from './record-detail-tw';

export default function SabcrmTwentyDetailPage(): React.JSX.Element {
  const params = useParams<{ objectSlug: string; recordId: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const recordId = params?.recordId ?? '';
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [record, setRecord] = React.useState<SabcrmRustRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const objRes = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!objRes.ok) {
        setError(objRes.error);
        setObject(null);
        setLoading(false);
        return;
      }
      const found = objRes.data.find((o) => o.slug === objectSlug) ?? null;
      setObject(found);
      if (!found) {
        setLoading(false);
        return;
      }

      const recRes = await getSabcrmRecordTw(
        objectSlug,
        recordId,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!recRes.ok) {
        setError(recRes.error);
        setRecord(null);
      } else {
        setRecord(recRes.data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [objectSlug, recordId, activeProjectId]);

  if (loading) {
    return (
      <div className="st-page">
        <div className="st-skeleton" style={{ height: 16, width: 120, marginBottom: 20 }} />
        <div className="st-skeleton" style={{ height: 28, width: 240, marginBottom: 24 }} />
        <div className="st-skeleton" style={{ height: 220, width: '100%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="st-page">
        <Link href={`/sabcrm/${objectSlug}`} className="st-back">
          ← Back
        </Link>
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={15} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!object || !record) {
    return (
      <div className="st-page">
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Record not found</h2>
          <p className="st-empty__desc">
            This record may have been removed, or you may not have access to it.
          </p>
          <TwentyButton variant="secondary">
            <Link
              href={`/sabcrm/${objectSlug}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Back
            </Link>
          </TwentyButton>
        </div>
      </div>
    );
  }

  return (
    <RecordDetailTw object={object} record={record} projectId={activeProjectId} />
  );
}
