'use client';

/**
 * Client interactivity for the API keys management page.
 * Server component (page.tsx) seeds the list; this component handles
 * the create dialog, plaintext "shown once" reveal, and revoke action.
 */

import { useState, useTransition } from 'react';
import {
  createDeveloperKey,
  revokeDeveloperKey,
} from '@/app/actions/developer-platform.actions';

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
    <div className="space-y-6">
      {revealed ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-amber-300 mb-1">Save this key now</div>
          <div className="text-xs text-amber-200 mb-2">
            You won&apos;t be able to see it again. Copy it into your secret store before closing this banner.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 overflow-x-auto">
              {revealed}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(revealed)}
              className="px-3 py-2 text-xs border border-amber-500/40 rounded hover:bg-amber-500/20"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="px-3 py-2 text-xs border border-zinc-700 rounded hover:bg-zinc-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="text-sm font-semibold mb-2">Generate new key</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. production webhook"
            className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-zinc-400 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Name</th>
              <th className="text-left px-3 py-2 font-semibold">Requests</th>
              <th className="text-left px-3 py-2 font-semibold">Created</th>
              <th className="text-left px-3 py-2 font-semibold">Last used</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-right px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500 text-sm">
                  No keys yet. Generate one above to get started.
                </td>
              </tr>
            ) : null}
            {keys.map((k) => (
              <tr key={k._id} className="border-t border-zinc-800">
                <td className="px-3 py-2">{k.name}</td>
                <td className="px-3 py-2 text-zinc-400">{k.requestCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-zinc-400">{formatDate(k.createdAt)}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {k.lastUsedAt ? formatDate(k.lastUsedAt) : '—'}
                </td>
                <td className="px-3 py-2">
                  {k.revoked ? (
                    <span className="text-xs text-red-400">Revoked</span>
                  ) : (
                    <span className="text-xs text-green-400">Active</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {!k.revoked ? (
                    <button
                      type="button"
                      onClick={() => handleRevoke(k._id)}
                      disabled={busy}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
