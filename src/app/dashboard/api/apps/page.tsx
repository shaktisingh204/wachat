import { listOAuthApps } from '@/app/actions/developer-platform.actions';
import { AppsClient } from './_AppsClient';

export const dynamic = 'force-dynamic';

export default async function OAuthAppsPage(): Promise<JSX.Element> {
  const res = await listOAuthApps();
  const initial = res.success ? res.apps : [];
  const loadError = res.success ? null : res.error;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">OAuth apps</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Register third-party clients to issue scoped access tokens via the Authorization
          Code + PKCE flow. Token endpoint: <code className="text-amber-300">/api/v1/oauth/token</code>.
        </p>
      </header>
      {loadError ? (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Failed to load apps: {loadError}
        </div>
      ) : null}
      <AppsClient initialApps={initial} />
    </div>
  );
}
