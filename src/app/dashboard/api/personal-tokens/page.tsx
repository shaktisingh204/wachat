import { listPersonalTokens } from '@/app/actions/developer-platform.actions';
import { PatsClient } from './_PatsClient';

export const dynamic = 'force-dynamic';

export default async function PersonalTokensPage(): Promise<JSX.Element> {
  const res = await listPersonalTokens();
  const initial = res.success ? (res.tokens as Parameters<typeof PatsClient>[0]['initialTokens']) : [];
  const loadError = res.success ? null : res.error;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">Personal Access Tokens</h1>
        <p className="text-sm text-zinc-500 mt-1">
          User-scoped tokens. Calls inherit your RBAC, so a PAT can only do what your account can.
          Format: <code className="text-amber-300">sab_pat_*</code>.
        </p>
      </header>
      {loadError ? (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Failed to load tokens: {loadError}
        </div>
      ) : null}
      <PatsClient initialTokens={initial} />
    </div>
  );
}
