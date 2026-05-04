'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuKey, LuPlus, LuCopy, LuTrash2, LuCheck, LuShieldAlert, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getApiKeys, createApiKey, revokeApiKey } from '@/app/actions/wachat-features.actions';

function maskKey(key: string) {
  if (key.length <= 12) return key;
  return key.slice(0, 8) + '...' + key.slice(-4);
}

export default function ApiKeysPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setKeys(res.keys ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    if (!newName.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await createApiKey(projectId, newName.trim());
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Key Created', description: res.message });
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
    if (!window.confirm(`Revoke API key "${keyName}"? Any services using it will stop working immediately.`)) return;
    startMutateTransition(async () => {
      const res = await revokeApiKey(keyId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Revoked', description: 'API key has been revoked.' });
      fetchData();
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'API Keys' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">API Keys</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Manage API keys for programmatic access to WhatsApp APIs.</p>
        </div>
        <ClayButton variant="obsidian" size="sm" onClick={() => setShowCreate(true)}
          leading={<LuPlus className="h-3.5 w-3.5" />}>
          Create New Key
        </ClayButton>
      </div>

      {showCreate && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-foreground mb-3">New API Key</h2>
          <div className="flex gap-3 max-w-md">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Key name (e.g. Production)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
            <ClayButton size="sm" onClick={handleCreate} disabled={!newName.trim() || isMutating}>Create</ClayButton>
            <ClayButton size="sm" variant="pill" onClick={() => setShowCreate(false)}>Cancel</ClayButton>
          </div>
        </ClayCard>
      )}

      {newlyCreatedKey && (
        <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <LuKey className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-emerald-800 font-medium">New key created. Copy it now - it will not be shown in full again.</p>
            <code className="mt-1 block text-[12px] font-mono text-emerald-900 break-all">{newlyCreatedKey}</code>
          </div>
          <button onClick={() => { handleCopy(newlyCreatedKey, 'new'); setNewlyCreatedKey(null); }}
            className="shrink-0 rounded-md bg-emerald-200 px-2 py-1 text-[11px] text-emerald-800 hover:bg-emerald-300">
            Copy
          </button>
        </div>
      )}

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <LuShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-amber-800">Keep your API keys secure. Do not share them in public repositories or client-side code.</p>
      </div>

      {keys.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-[13px] text-foreground">{k.name}</td>
                  <td className="px-5 py-3 text-[13px] text-foreground font-mono">{maskKey(k.key)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${k.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleCopy(k.key, k._id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors" title="Copy">
                        {copiedId === k._id ? <LuCheck className="h-3.5 w-3.5 text-emerald-600" /> : <LuCopy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {k.isActive && (
                        <button onClick={() => handleRevoke(k._id, k.name || 'Unnamed')} disabled={isMutating}
                          className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-red-500" title="Revoke">
                          <LuTrash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuKey className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
