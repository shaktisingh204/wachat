'use client';

import { useState, useTransition } from 'react';
import {
  createDeveloperKey,
  revokeDeveloperKey,
} from '@/app/actions/developer-platform.actions';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Alert, AlertDescription, Table, THead, Th, TBody, Tr, Td, Badge, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle, TriangleAlert, Copy, Key } from 'lucide-react';

interface KeyRow {
  _id: string;
  name: string;
  revoked: boolean;
  requestCount: number;
  createdAt: string;
  lastUsedAt?: string;
  scopes?: string[];
  key?: string;
}

interface Props {
  initialKeys: KeyRow[];
  usageData?: any[];
  logsData?: any[];
}

export function KeysClient({ initialKeys, usageData = [], logsData = [] }: Props): JSX.Element {
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('me:read');
  const [busy, startBusy] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (): void => {
    if (!name.trim()) return;
    setError(null);
    startBusy(async () => {
      const parsedScopes = scopes.split(/[\s,]+/).filter(Boolean);
      const res = await createDeveloperKey(name.trim(), parsedScopes);
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
            scopes: parsedScopes,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setName('');
      setScopes('me:read');
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
              <code className="flex-1 text-xs font-mono bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded px-3 py-2 text-[var(--st-text)] overflow-x-auto">
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
        <CardHeader>
          <CardTitle>Generate new key</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production webhook"
              className="flex-1 min-w-[200px]"
              disabled={busy}
            />
            <Input
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="Scopes (e.g. me:read data:write)"
              className="flex-1 min-w-[200px] font-mono text-sm"
              disabled={busy}
            />
            <Button
              onClick={handleCreate}
              disabled={busy || !name.trim()}
            >
              {busy ? 'Working…' : 'Generate'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Key</Th>
              <Th>Scopes</Th>
              <Th>Requests</Th>
              <Th>Created</Th>
              <Th>Last used</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {keys.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={<Key className="h-8 w-8" />}
                    title="No keys yet"
                    description="Generate a key above to get started."
                  />
                </Td>
              </Tr>
            ) : null}
            {keys.map((k) => (
              <Tr key={k._id}>
                <Td>{k.name}</Td>
                <Td className="font-mono text-sm text-[var(--st-text)]">
                  {maskKey(k.key)}
                </Td>
                <Td>
                    {k.scopes && k.scopes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {k.scopes.map(s => <Badge variant="outline" key={s} className="text-[10px] font-mono">{s}</Badge>)}
                        </div>
                    ) : <span className="text-[var(--st-text-secondary)] text-xs">All</span>}
                </Td>
                <Td className="text-[var(--st-text-secondary)]">
                    {usageData.find(u => u.keyId === k._id)?.count || k.requestCount || 0}
                </Td>
                <Td className="text-[var(--st-text-secondary)] text-xs">{formatDate(k.createdAt)}</Td>
                <Td className="text-[var(--st-text-secondary)] text-xs">
                  {usageData.find(u => u.keyId === k._id)?.lastUsedAt 
                    ? formatDate(usageData.find(u => u.keyId === k._id)?.lastUsedAt as string) 
                    : (k.lastUsedAt ? formatDate(k.lastUsedAt) : '—')}
                </Td>
                <Td>
                  {k.revoked ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    {k.key ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(k.key!)}
                        title="Copy key"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    ) : null}
                    {!k.revoked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(k._id)}
                        disabled={busy}
                        className="text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <Tr>
              <Th>Time</Th>
              <Th>Key ID</Th>
              <Th>Method</Th>
              <Th>Path</Th>
              <Th>Status</Th>
              <Th>Latency</Th>
            </Tr>
          </THead>
          <TBody>
            {logsData.length === 0 ? (
              <Tr>
                <Td colSpan={6} className="text-center text-[var(--st-text)] py-8">
                  No logs available.
                </Td>
              </Tr>
            ) : logsData.map((log) => (
              <Tr key={log._id}>
                <Td className="text-[var(--st-text-secondary)] text-xs">{formatDate(log.ts)}</Td>
                <Td className="font-mono text-xs">{log.keyId}</Td>
                <Td>
                  <Badge variant="outline">{log.method}</Badge>
                </Td>
                <Td className="font-mono text-xs max-w-[200px] truncate" title={log.path}>
                  {log.path}
                </Td>
                <Td>
                  <span className={log.status >= 400 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}>
                    {log.status}
                  </span>
                </Td>
                <Td className="text-[var(--st-text-secondary)] text-xs">{log.latencyMs} ms</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

function maskKey(key?: string) {
  if (!key || typeof key !== 'string') return '—';
  if (key.length <= 12) return '•'.repeat(key.length);
  return key.slice(0, 8) + '…' + key.slice(-4);
}
