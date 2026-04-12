'use client';

/**
 * Wachat API Keys — manage API keys for WhatsApp API access.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuKey, LuPlus, LuCopy, LuTrash2, LuCheck, LuShieldAlert } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

type ApiKeyItem = { id: string; name: string; key: string; created: string; lastUsed: string };

function maskKey(key: string) {
  return key.slice(0, 8) + '...' + key.slice(-4);
}

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return 'wk_' + Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ApiKeysPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    { id: '1', name: 'Production Key', key: 'wk_a8f3kJ29xMp5qL7nR2vT0wYz4bC6dE1gH', created: '2026-03-15', lastUsed: '2026-04-12' },
    { id: '2', name: 'Development Key', key: 'wk_m9n2oP4qR6sT8uV0wX3yZ5aB7cD1eF2gH', created: '2026-02-20', lastUsed: '2026-04-10' },
  ]);
  const [newName, setNewName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const newKey: ApiKeyItem = {
      id: Date.now().toString(),
      name: newName.trim(),
      key: generateKey(),
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
    };
    setKeys((prev) => [newKey, ...prev]);
    setNewName('');
    setShowCreate(false);
    toast({ title: 'Key Created', description: `API key "${newKey.name}" has been created.` });
  };

  const handleCopy = async (item: ApiKeyItem) => {
    await navigator.clipboard.writeText(item.key);
    setCopiedId(item.id);
    toast({ title: 'Copied', description: 'API key copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    toast({ title: 'Revoked', description: 'API key has been revoked.' });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'API Keys' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">API Keys</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Manage API keys for programmatic access to WhatsApp APIs.</p>
        </div>
        <ClayButton variant="obsidian" size="sm" onClick={() => setShowCreate(true)}
          leading={<LuPlus className="h-3.5 w-3.5" />}>
          Create New Key
        </ClayButton>
      </div>

      {showCreate && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-3">New API Key</h2>
          <div className="flex gap-3 max-w-md">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Key name (e.g. Production)"
              className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
            <ClayButton size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</ClayButton>
            <ClayButton size="sm" variant="pill" onClick={() => setShowCreate(false)}>Cancel</ClayButton>
          </div>
        </ClayCard>
      )}

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <LuShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-amber-800">Keep your API keys secure. Do not share them in public repositories or client-side code.</p>
      </div>

      {keys.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Last Used</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 font-medium text-[13px] text-clay-ink">{k.name}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink font-mono">{maskKey(k.key)}</td>
                  <td className="px-5 py-3 text-[12px] text-clay-ink-muted">{k.created}</td>
                  <td className="px-5 py-3 text-[12px] text-clay-ink-muted">{k.lastUsed}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleCopy(k)} className="p-1.5 rounded-md hover:bg-clay-surface-2 transition-colors" title="Copy">
                        {copiedId === k.id ? <LuCheck className="h-3.5 w-3.5 text-emerald-600" /> : <LuCopy className="h-3.5 w-3.5 text-clay-ink-muted" />}
                      </button>
                      <button onClick={() => handleRevoke(k.id)} className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-red-500" title="Revoke">
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuKey className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No API keys yet. Create one to get started.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
