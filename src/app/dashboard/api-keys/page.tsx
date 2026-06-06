'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Check,
  Copy,
  Key,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getApiKeys,
  createApiKey,
  revokeApiKey } from '@/app/actions/wachat-features.actions';

import * as React from 'react';

function maskKey(key: string) {
  if (key.length <= 12) return key;
  return key.slice(0, 8) + '…' + key.slice(-4);
}

export default function ApiKeysPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [keys, setKeys] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getApiKeys(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setKeys(res.keys ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    if (!newName.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await createApiKey(projectId, newName.trim());
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Key created', description: res.message });
      if (res.key) setNewlyCreatedKey(res.key);
      setNewName('');
      setShowCreate(false);
      fetchData();
    });
  };

  const handleCopy = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast({ title: 'Copied', description: 'API key copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = (keyId: string, keyName: string) => {
    if (
      !window.confirm(
        `Revoke API key "${keyName}"? Any services using it will stop working immediately.`,
      )
    )
      return;
    startMutateTransition(async () => {
      const res = await revokeApiKey(keyId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Revoked', description: 'API key has been revoked.' });
      fetchData();
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>API keys</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>API keys</ZoruPageTitle>
            <ZoruPageDescription>
              Manage API keys for programmatic access to WhatsApp APIs.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Create new key
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5">
          <h2 className="mb-3 text-[15px] text-zoru-ink">New API key</h2>
          <div className="flex max-w-md gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Key name (e.g. Production)"
              className="flex-1"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || isMutating}>
              Create
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {newlyCreatedKey && (
        <Alert variant="success">
          <Key className="h-4 w-4" />
          <ZoruAlertTitle>New key created</ZoruAlertTitle>
          <ZoruAlertDescription>
            Copy it now — it will not be shown in full again.
            <code className="mt-1 block break-all font-mono text-xs">{newlyCreatedKey}</code>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                handleCopy(newlyCreatedKey, 'new');
                setNewlyCreatedKey(null);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy key
            </Button>
          </ZoruAlertDescription>
        </Alert>
      )}

      <Alert variant="warning">
        <ShieldAlert className="h-4 w-4" />
        <ZoruAlertDescription>
          Keep your API keys secure. Do not share them in public repositories or client-side code.
        </ZoruAlertDescription>
      </Alert>

      {keys.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k._id} className="border-b border-zoru-line last:border-0">
                  <td className="px-5 py-3 text-sm text-zoru-ink">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-sm text-zoru-ink">{maskKey(k.key)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={k.isActive ? 'success' : 'danger'}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-zoru-ink-muted">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleCopy(k.key, k._id)}
                        aria-label="Copy"
                      >
                        {copiedId === k._id ? (
                          <Check className="h-3.5 w-3.5 text-zoru-success-ink" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {k.isActive && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleRevoke(k._id, k.name || 'Unnamed')}
                          disabled={isMutating}
                          aria-label="Revoke"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-zoru-danger" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          icon={<Key className="h-12 w-12" />}
          title="No API keys yet"
          description="Create one to get started."
        />
      )}
    </div>
  );
}
