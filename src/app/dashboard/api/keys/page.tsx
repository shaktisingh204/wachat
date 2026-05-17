/**
 * API keys management page.
 *
 * Server Component — seeds the initial list by calling the
 * `listDeveloperKeys` action, then hands off to the client component
 * for create / revoke interactivity.
 */

import { listDeveloperKeys } from '@/app/actions/developer-platform.actions';
import { KeysClient } from './_KeysClient';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage(): Promise<JSX.Element> {
  const res = await listDeveloperKeys();
  const initialKeys = res.success ? (res.keys as Parameters<typeof KeysClient>[0]['initialKeys']) : [];
  const loadError = res.success ? null : res.error;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">API keys</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tenant-scoped Bearer tokens for server-to-server integrations. Treat them like
          passwords — they grant full programmatic access.
        </p>
      </header>

      {loadError ? (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Failed to load keys: {loadError}
        </div>
      ) : null}

      <KeysClient initialKeys={initialKeys} />
    </div>
  );
}
