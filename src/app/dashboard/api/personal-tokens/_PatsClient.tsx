'use client';

import { useState, useTransition } from 'react';
import {
  createPersonalToken,
  revokePersonalToken,
} from '@/app/actions/developer-platform.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Button, Input, Label, Alert, Table, THead, Th, TBody, Tr, Td, Badge, EmptyState, useToast } from '@/components/sabcrm/20ui/compat';
import { TriangleAlert, Copy, KeyRound } from 'lucide-react';

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
  const [busy, startBusy] = useTransition();
  const { toast } = useToast();

  const handleCreate = (): void => {
    if (!name.trim()) return;
    startBusy(async () => {
      const res = await createPersonalToken(name.trim(), undefined, expiresAt || undefined);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error || 'Failed to create token',
          variant: 'destructive',
        });
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
        toast({
          title: 'Success',
          description: 'Token created successfully.',
        });
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
        toast({
          title: 'Error',
          description: res.error || 'Failed to revoke token',
          variant: 'destructive',
        });
        return;
      }
      setTokens((prev) => prev.map((t) => (t._id === id ? { ...t, revoked: true } : t)));
      toast({
        title: 'Success',
        description: 'Token revoked successfully.',
      });
    });
  };

  return (
    <div className="space-y-4">
      {revealed ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">Save this token now — shown once. Treat it as a password.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded px-3 py-2 text-[var(--st-text)] overflow-x-auto">
                {revealed}
              </code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(revealed)}>
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
        <CardHeader>
          <CardTitle>Generate Personal Access Token</CardTitle>
          <CardDescription>PATs inherit your RBAC and can only do what your account is allowed to do.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. local-dev"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                disabled={busy}
              />
            </div>
            <Button onClick={handleCreate} disabled={busy || !name.trim()}>
              {busy ? 'Working…' : 'Generate'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Scopes</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {tokens.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={<KeyRound className="h-8 w-8" />}
                    title="No tokens yet"
                    description="Generate a PAT above to get started."
                  />
                </Td>
              </Tr>
            ) : null}
            {tokens.map((t) => (
              <Tr key={t._id}>
                <Td>{t.name}</Td>
                <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                  {t.scopes.join(' ') || '*'}
                </Td>
                <Td className="text-xs text-[var(--st-text-secondary)]" suppressHydrationWarning>{fmt(t.createdAt)}</Td>
                <Td className="text-xs text-[var(--st-text-secondary)]" suppressHydrationWarning>
                  {t.expiresAt ? fmt(t.expiresAt) : '—'}
                </Td>
                <Td>
                  {t.revoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  {!t.revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(t._id)}
                      disabled={busy}
                      className="text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                    >
                      Revoke
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
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
