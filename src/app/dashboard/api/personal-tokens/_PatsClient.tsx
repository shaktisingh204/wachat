'use client';

import { useState, useTransition } from 'react';
import {
  createPersonalToken,
  revokePersonalToken,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Input,
  Field,
  Alert,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
  Badge,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Copy, KeyRound } from 'lucide-react';

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
        toast.error(res.error || 'Failed to create token');
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
        toast.success('Token created successfully.');
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
        toast.error(res.error || 'Failed to revoke token');
        return;
      }
      setTokens((prev) => prev.map((t) => (t._id === id ? { ...t, revoked: true } : t)));
      toast.success('Token revoked successfully.');
    });
  };

  return (
    <div className="space-y-4">
      {revealed ? (
        <Alert
          tone="warning"
          title="Save this token now, shown once. Treat it as a password."
          onClose={() => setRevealed(null)}
          closeLabel="Dismiss"
        >
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] px-3 py-2 text-[var(--st-text)] overflow-x-auto">
              {revealed}
            </code>
            <Button
              size="sm"
              variant="outline"
              iconLeft={Copy}
              onClick={() => navigator.clipboard.writeText(revealed)}
            >
              Copy
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Generate Personal Access Token</CardTitle>
          <CardDescription>
            PATs inherit your RBAC and can only do what your account is allowed to do.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. local-dev"
                disabled={busy}
              />
            </Field>
            <Field label="Expires at (optional)">
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')
                }
                disabled={busy}
              />
            </Field>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!name.trim()}
              loading={busy}
            >
              Generate
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card padding="none">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Scopes</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {tokens.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={KeyRound}
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
                <Td className="text-xs text-[var(--st-text-secondary)]" suppressHydrationWarning>
                  {fmt(t.createdAt)}
                </Td>
                <Td className="text-xs text-[var(--st-text-secondary)]" suppressHydrationWarning>
                  {t.expiresAt ? fmt(t.expiresAt) : '-'}
                </Td>
                <Td>
                  {t.revoked ? (
                    <Badge tone="danger">Revoked</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </Td>
                <Td align="right">
                  {!t.revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(t._id)}
                      disabled={busy}
                      className="text-[var(--st-danger)]"
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
