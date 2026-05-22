'use client';

import { useState, useTransition } from 'react';
import {
  createDeveloperKey,
  revokeDeveloperKey,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent,
  Button,
  Input,
  Alert,
  ZoruAlertDescription,
  Table,
  ZoruTableHeader,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableCell,
  Badge,
  EmptyState,
} from '@/components/zoruui';
import { AlertCircle, TriangleAlert, Copy, Key } from 'lucide-react';

interface KeyRow {
  _id: string;
  name: string;
  revoked: boolean;
  requestCount: number;
  createdAt: string;
  lastUsedAt?: string;
}

interface Props {
  initialKeys: KeyRow[];
}

export function KeysClient({ initialKeys }: Props): JSX.Element {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [name, setName] = useState('');
  const [busy, startBusy] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (): void => {
    if (!name.trim()) return;
    setError(null);
    startBusy(async () => {
      const res = await createDeveloperKey(name.trim());
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.apiKey && res.keyId) {
        setRevealed(res.apiKey);
        setKeys((prev) => [
          {
            _id: res.keyId!,
            name: name.trim(),
            revoked: false,
            requestCount: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setName('');
    });
  };

  const handleRevoke = (id: string): void => {
    if (!confirm('Revoke this key? Calls using it will fail immediately.')) return;
    startBusy(async () => {
      const res = await revokeDeveloperKey(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setKeys((prev) => prev.map((k) => (k._id === id ? { ...k, revoked: true } : k)));
    });
  };

  return (
    <div className="space-y-4">
      {revealed ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">Save this key now — you won&apos;t see it again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-zoru-surface border border-zoru-line rounded px-3 py-2 text-zoru-ink overflow-x-auto">
                {revealed}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(revealed)}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Generate new key</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production webhook"
              className="flex-1 min-w-[200px]"
              disabled={busy}
            />
            <Button
              onClick={handleCreate}
              disabled={busy || !name.trim()}
            >
              {busy ? 'Working…' : 'Generate'}
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      <Card>
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Requests</ZoruTableHead>
              <ZoruTableHead>Created</ZoruTableHead>
              <ZoruTableHead>Last used</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {keys.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6}>
                  <EmptyState
                    icon={<Key className="h-8 w-8" />}
                    title="No keys yet"
                    description="Generate a key above to get started."
                  />
                </ZoruTableCell>
              </ZoruTableRow>
            ) : null}
            {keys.map((k) => (
              <ZoruTableRow key={k._id}>
                <ZoruTableCell>{k.name}</ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink-muted">{k.requestCount.toLocaleString()}</ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink-muted text-xs">{formatDate(k.createdAt)}</ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink-muted text-xs">
                  {k.lastUsedAt ? formatDate(k.lastUsedAt) : '—'}
                </ZoruTableCell>
                <ZoruTableCell>
                  {k.revoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </ZoruTableCell>
                <ZoruTableCell className="text-right">
                  {!k.revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(k._id)}
                      disabled={busy}
                      className="text-zoru-danger hover:text-zoru-danger"
                    >
                      Revoke
                    </Button>
                  ) : null}
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </Table>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
