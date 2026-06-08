'use client';

import { useState, useTransition } from 'react';
import {
  createDeveloperKey,
  revokeDeveloperKey,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  IconButton,
  Input,
  Field,
  Alert,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Copy, Key, X } from 'lucide-react';

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
  const { toast } = useToast();
  const [keys, setKeys] = useState<KeyRow[]>(initialKeys);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('me:read');
  const [busy, startBusy] = useTransition();
  const [revealed, setRevealed] = useState<string | null>(null);

  const handleCreate = (): void => {
    if (!name.trim()) return;
    startBusy(async () => {
      const parsedScopes = scopes.split(/[\s,]+/).filter(Boolean);
      const res = await createDeveloperKey(name.trim(), parsedScopes);
      if (!res.success) {
        toast.error(res.error);
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
        toast.success('Key generated');
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
        toast.error(res.error);
        return;
      }
      setKeys((prev) => prev.map((k) => (k._id === id ? { ...k, revoked: true } : k)));
      toast.success('Key revoked');
    });
  };

  const copyKey = (value: string): void => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="20ui space-y-4">
      {revealed ? (
        <Alert
          tone="warning"
          title="Save this key now. You will not see it again."
          onClose={() => setRevealed(null)}
          closeLabel="Dismiss key"
        >
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs font-mono bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] px-3 py-2 text-[var(--st-text)] overflow-x-auto">
              {revealed}
            </code>
            <Button
              size="sm"
              variant="outline"
              iconLeft={Copy}
              onClick={() => copyKey(revealed)}
            >
              Copy
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Generate new key</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Key name" className="flex-1 min-w-[200px]">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. production webhook"
                disabled={busy}
              />
            </Field>
            <Field label="Scopes" help="Space or comma separated, e.g. me:read data:write" className="flex-1 min-w-[200px]">
              <Input
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                placeholder="me:read data:write"
                className="font-mono"
                disabled={busy}
              />
            </Field>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={busy}
              disabled={busy || !name.trim()}
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
              <Th>Key</Th>
              <Th>Scopes</Th>
              <Th>Requests</Th>
              <Th>Created</Th>
              <Th>Last used</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {keys.length === 0 ? (
              <Tr>
                <Td colSpan={8}>
                  <EmptyState
                    icon={Key}
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
                      {k.scopes.map((s) => (
                        <Badge variant="outline" key={s} className="text-[10px] font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--st-text-secondary)] text-xs">All</span>
                  )}
                </Td>
                <Td className="text-[var(--st-text-secondary)]">
                  {usageData.find((u) => u.keyId === k._id)?.count || k.requestCount || 0}
                </Td>
                <Td className="text-[var(--st-text-secondary)] text-xs">{formatDate(k.createdAt)}</Td>
                <Td className="text-[var(--st-text-secondary)] text-xs">
                  {usageData.find((u) => u.keyId === k._id)?.lastUsedAt
                    ? formatDate(usageData.find((u) => u.keyId === k._id)?.lastUsedAt as string)
                    : k.lastUsedAt
                      ? formatDate(k.lastUsedAt)
                      : '-'}
                </Td>
                <Td>
                  {k.revoked ? (
                    <Badge tone="danger">Revoked</Badge>
                  ) : (
                    <Badge tone="success" dot>Active</Badge>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-2">
                    {k.key ? (
                      <IconButton
                        label="Copy key"
                        icon={Copy}
                        size="sm"
                        onClick={() => copyKey(k.key!)}
                      />
                    ) : null}
                    {!k.revoked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={X}
                        onClick={() => handleRevoke(k._id)}
                        disabled={busy}
                        className="text-[var(--st-danger)]"
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

      <Card padding="none">
        <CardHeader>
          <CardTitle>Audit logs</CardTitle>
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
                <Td colSpan={6}>
                  <EmptyState title="No logs available" description="API request logs will appear here." />
                </Td>
              </Tr>
            ) : (
              logsData.map((log) => (
                <Tr key={log._id}>
                  <Td className="text-[var(--st-text-secondary)] text-xs">{formatDate(log.ts)}</Td>
                  <Td className="font-mono text-xs">{log.keyId}</Td>
                  <Td>
                    <Badge variant="outline">{log.method}</Badge>
                  </Td>
                  <Td truncate className="font-mono text-xs max-w-[200px]" title={log.path}>
                    {log.path}
                  </Td>
                  <Td>
                    <Badge tone={log.status >= 400 ? 'danger' : 'success'}>{log.status}</Badge>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)] text-xs">{log.latencyMs} ms</Td>
                </Tr>
              ))
            )}
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

function maskKey(key?: string): string {
  if (!key || typeof key !== 'string') return '-';
  if (key.length <= 12) return '•'.repeat(key.length);
  return key.slice(0, 8) + '…' + key.slice(-4);
}
