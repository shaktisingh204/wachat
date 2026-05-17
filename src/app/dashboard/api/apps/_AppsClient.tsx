'use client';

import { useState, useTransition } from 'react';
import {
  registerOAuthApp,
  deleteOAuthApp,
  type OAuthAppRow,
} from '@/app/actions/developer-platform.actions';

interface Props {
  initialApps: OAuthAppRow[];
}

export function AppsClient({ initialApps }: Props): JSX.Element {
  const [apps, setApps] = useState<OAuthAppRow[]>(initialApps);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [redirects, setRedirects] = useState('');
  const [scopes, setScopes] = useState('me:read');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const handleCreate = (): void => {
    const redirectUris = redirects
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || redirectUris.length === 0) {
      setError('name and at least one redirect URI are required.');
      return;
    }
    setError(null);
    startBusy(async () => {
      const res = await registerOAuthApp({
        name: name.trim(),
        description: description.trim() || undefined,
        redirectUris,
        scopes: scopes.split(/[\s,]+/).filter(Boolean),
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setApps((prev) => [res.app, ...prev]);
      setSecret(res.clientSecret);
      setName('');
      setDescription('');
      setRedirects('');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this app? All issued tokens will be revoked.')) return;
    startBusy(async () => {
      const res = await deleteOAuthApp(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setApps((prev) => prev.filter((a) => a._id !== id));
    });
  };

  return (
    <div className="space-y-6">
      {secret ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-semibold text-amber-300 mb-1">
            Save this client secret
          </div>
          <div className="text-xs text-amber-200 mb-2">
            Shown once. Configure it in your OAuth client alongside the client_id.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 overflow-x-auto">
              {secret}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(secret)}
              className="px-3 py-2 text-xs border border-amber-500/40 rounded hover:bg-amber-500/20"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setSecret(null)}
              className="px-3 py-2 text-xs border border-zinc-700 rounded hover:bg-zinc-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="text-sm font-semibold mb-3">Register OAuth app</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-zinc-400">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100"
              disabled={busy}
            />
          </label>
          <label className="text-xs text-zinc-400">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100"
              disabled={busy}
            />
          </label>
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Redirect URIs (one per line)
            <textarea
              value={redirects}
              onChange={(e) => setRedirects(e.target.value)}
              rows={2}
              placeholder="https://yourapp.com/oauth/callback"
              className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono"
              disabled={busy}
            />
          </label>
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Requested scopes (space-separated)
            <input
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              className="mt-1 block w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono"
              disabled={busy}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !name.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Register'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {apps.length === 0 ? (
          <div className="rounded-md border border-zinc-800 p-6 text-center text-sm text-zinc-500">
            No OAuth apps yet.
          </div>
        ) : null}
        {apps.map((a) => (
          <div key={a._id} className="rounded-md border border-zinc-800 p-4 bg-zinc-900/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{a.name}</div>
                {a.description ? (
                  <div className="text-xs text-zinc-400 mt-0.5">{a.description}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a._id)}
                disabled={busy}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-zinc-500">Client ID</div>
                <code className="font-mono text-zinc-200">{a.clientId}</code>
              </div>
              <div>
                <div className="text-zinc-500">Created</div>
                <div className="text-zinc-300">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-zinc-500">Redirect URIs</div>
                <ul className="font-mono text-zinc-200">
                  {a.redirectUris.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
              <div className="sm:col-span-2">
                <div className="text-zinc-500">Allowed scopes</div>
                <code className="font-mono text-zinc-200">{a.scopes.join(' ')}</code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
