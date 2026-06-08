'use client';

import * as React from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Flag,
  Link2,
  Radar,
  ShieldCheck,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  scanSabpublishCitations,
  updateSabpublishCitationStatus,
} from '@/app/actions/sabpublish.actions';
import type {
  SabpublishCitationDoc,
  SabpublishCitationStatus,
} from '@/lib/rust-client/sabpublish-citations';

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'claimed':
      return 'info';
    case 'resolved':
      return 'success';
    case 'disputed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function scoreTone(score: number): BadgeTone {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

export function SabpublishCitationsTab({
  locationId,
  initial,
}: {
  locationId: string;
  initial: SabpublishCitationDoc[];
}) {
  const [items, setItems] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function handleScan() {
    setBusy(true);
    await scanSabpublishCitations(locationId);
    setBusy(false);
    // Listing refresh is handled by revalidatePath on the server; reload the
    // tab to see new results.
  }

  async function handleUpdate(id: string, status: SabpublishCitationStatus) {
    setBusyId(id);
    const res = await updateSabpublishCitationStatus(id, status);
    if (res.ok) setItems((p) => p.map((c) => (c._id === id ? res.data : c)));
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--st-text-secondary)]">
          NAP mentions of this location found across the web.
        </p>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={Radar}
          onClick={handleScan}
          loading={busy}
        >
          Scan for citations
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardBody className="p-6">
            <EmptyState
              icon={Link2}
              title="No citations found"
              description="Run a scan to discover where this location is mentioned across directories and the web."
              action={
                <Button
                  variant="primary"
                  iconLeft={Radar}
                  onClick={handleScan}
                  loading={busy}
                >
                  Run a scan
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {items.map((c) => (
            <li key={c._id}>
              <Card>
                <CardBody className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 font-medium hover:underline"
                    >
                      <ExternalLink
                        size={14}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      <span className="truncate">{c.sourceUrl}</span>
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={scoreTone(c.matchScore)}>
                        {c.matchScore}% match
                      </Badge>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    {[
                      c.foundFields.name && `Name: ${c.foundFields.name}`,
                      c.foundFields.address && `Address: ${c.foundFields.address}`,
                      c.foundFields.phone && `Phone: ${c.foundFields.phone}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No matched fields'}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={ShieldCheck}
                      onClick={() => handleUpdate(c._id, 'claimed')}
                      disabled={busyId === c._id}
                    >
                      Claim
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={Flag}
                      onClick={() => handleUpdate(c._id, 'disputed')}
                      disabled={busyId === c._id}
                    >
                      Dispute
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={CheckCircle2}
                      onClick={() => handleUpdate(c._id, 'resolved')}
                      disabled={busyId === c._id}
                    >
                      Mark resolved
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
