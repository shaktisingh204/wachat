'use client';

import * as React from 'react';

import { Badge, Button, Card, CardBody, EmptyState } from '@/components/sabcrm/20ui';
import {
  scanSabpublishCitations,
  updateSabpublishCitationStatus,
} from '@/app/actions/sabpublish.actions';
import type {
  SabpublishCitationDoc,
  SabpublishCitationStatus,
} from '@/lib/rust-client/sabpublish-citations';

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
    // Listing refresh is handled by revalidatePath on the server; the user
    // can reload the tab to see results. (TODO: re-fetch in-place once a
    // list-by-locationId action helper is added.)
  }

  async function handleUpdate(
    id: string,
    status: SabpublishCitationStatus,
  ) {
    setBusyId(id);
    const res = await updateSabpublishCitationStatus(id, status);
    if (res.ok) setItems((p) => p.map((c) => (c._id === id ? res.data : c)));
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleScan} disabled={busy} size="sm">
          {busy ? 'Scanning…' : 'Scan for citations'}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No citations found"
          description="Run a scan to discover NAP mentions of this location across the web."
        />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c._id}>
              <CardBody className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline"
                  >
                    {c.sourceUrl}
                  </a>
                  <Badge variant="outline">
                    {c.matchScore}% · {c.status}
                  </Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {c.foundFields.name ? `Name: ${c.foundFields.name} · ` : ''}
                  {c.foundFields.address
                    ? `Addr: ${c.foundFields.address} · `
                    : ''}
                  {c.foundFields.phone ? `Phone: ${c.foundFields.phone}` : ''}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdate(c._id, 'claimed')}
                    disabled={busyId === c._id}
                  >
                    Claim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdate(c._id, 'disputed')}
                    disabled={busyId === c._id}
                  >
                    Dispute
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUpdate(c._id, 'resolved')}
                    disabled={busyId === c._id}
                  >
                    Mark resolved
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
