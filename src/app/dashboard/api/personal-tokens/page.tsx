import { listPersonalTokens } from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  StatCard,
} from '@/components/sabcrm/20ui';
import { KeyRound, CheckCircle2, Clock } from 'lucide-react';
import { PatsClient } from './_PatsClient';

export const dynamic = 'force-dynamic';

export default async function PersonalTokensPage(): Promise<JSX.Element> {
  const res = await listPersonalTokens();

  if (!res.success) {
    throw new Error(res.error || 'Failed to load tokens');
  }

  const initial = res.tokens as Parameters<typeof PatsClient>[0]['initialTokens'];

  const total = initial.length;
  const active = initial.filter((t) => !t.revoked).length;
  const expiring = initial.filter((t) => !t.revoked && t.expiresAt).length;

  return (
    <div className="20ui flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>Personal Access Tokens</PageTitle>
          <PageDescription>
            User-scoped tokens. Calls inherit your RBAC, so a PAT can only do what your account
            can. Format: <code className="font-mono">sab_pat_*</code>.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total tokens" value={String(total)} icon={<KeyRound />} accent="#7c3aed" />
        <StatCard label="Active" value={String(active)} icon={<CheckCircle2 />} accent="#1f9d55" />
        <StatCard label="With expiry" value={String(expiring)} icon={<Clock />} accent="#d97706" />
      </div>

      <PatsClient initialTokens={initial} />
    </div>
  );
}
