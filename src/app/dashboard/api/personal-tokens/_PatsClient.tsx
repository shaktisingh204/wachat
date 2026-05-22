'use client';

import { useState, useTransition } from 'react';
import {
  createPersonalToken,
  revokePersonalToken,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Input,
  Label,
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
import { AlertCircle, TriangleAlert, Copy, KeyRound } from 'lucide-react';

interface PatRow {
  _id: string;
  name: string;
  userId: string;
  scopes: string[];
  tier: string;
  revoked: boolean;
  requestCount: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

interface Props {
  initialTokens: PatRow[];
}

export function PatsClient({ initialTokens }: Props): JSX.Element {
  const [tokens, setTokens] = useState<PatRow[]>(initialTokens);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const handleCreate = (): void => {
    if (!name.trim()) return;
    setError(null);
    startBusy(async () => {
      const res = await createPersonalToken(name.trim(), undefined, expiresAt || undefined);
      if (!res.success) {
        setError(res.error);
        return;
      }
      if (res.token && res.tokenId) {
        setRevealed(res.token);
        setTokens((prev) => [
          {
            _id: res.tokenId!,
            name: name.trim(),
            userId: '',
            scopes: ['*'],
            tier: 'FREE',
            revoked: false,
            requestCount: 0,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt || undefined,
          },
          ...prev,
        ]);
      }
      setName('');
      setExpiresAt('');
    });
  };

  const handleRevoke = (id: string): void => {
    if (!confirm('Revoke this token? Any script using it will fail.')) return;
    startBusy(async () => {
      const res = await revokePersonalToken(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setTokens((prev) => prev.map((t) => (t._id === id ? { ...t, revoked: true } : t)));
    });
  };

  return (
    <div className="space-y-4">
      {revealed ? (
        <ZoruAlert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">Save this token now — shown once. Treat it as a password.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-zoru-surface border border-zoru-line rounded px-3 py-2 text-zoru-ink overflow-x-auto">
                {revealed}
              </code>
              <ZoruButton size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(revealed)}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                Dismiss
              </ZoruButton>
            </div>
          </div>
        </ZoruAlert>
      ) : null}

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Generate Personal Access Token</ZoruCardTitle>
          <ZoruCardDescription>PATs inherit your RBAC and can only do what your account is allowed to do.</ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <ZoruLabel>Name</ZoruLabel>
              <ZoruInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. local-dev"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel>Expires at (optional)</ZoruLabel>
              <ZoruInput
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                disabled={busy}
              />
            </div>
            <ZoruButton onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy ? 'Working…' : 'Generate'}
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {error ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : null}

      <ZoruCard>
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Scopes</ZoruTableHead>
              <ZoruTableHead>Created</ZoruTableHead>
              <ZoruTableHead>Expires</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {tokens.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6}>
                  <ZoruEmptyState
                    icon={<KeyRound className="h-8 w-8" />}
                    title="No tokens yet"
                    description="Generate a PAT above to get started."
                  />
                </ZoruTableCell>
              </ZoruTableRow>
            ) : null}
            {tokens.map((t) => (
              <ZoruTableRow key={t._id}>
                <ZoruTableCell>{t.name}</ZoruTableCell>
                <ZoruTableCell className="font-mono text-xs text-zoru-ink-muted">
                  {t.scopes.join(' ') || '*'}
                </ZoruTableCell>
                <ZoruTableCell className="text-xs text-zoru-ink-muted">{fmt(t.createdAt)}</ZoruTableCell>
                <ZoruTableCell className="text-xs text-zoru-ink-muted">
                  {t.expiresAt ? fmt(t.expiresAt) : '—'}
                </ZoruTableCell>
                <ZoruTableCell>
                  {t.revoked ? (
                    <ZoruBadge variant="destructive">Revoked</ZoruBadge>
                  ) : (
                    <ZoruBadge variant="success">Active</ZoruBadge>
                  )}
                </ZoruTableCell>
                <ZoruTableCell className="text-right">
                  {!t.revoked ? (
                    <ZoruButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(t._id)}
                      disabled={busy}
                      className="text-zoru-danger hover:text-zoru-danger"
                    >
                      Revoke
                    </ZoruButton>
                  ) : null}
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </ZoruTable>
      </ZoruCard>
    </div>
  );
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
