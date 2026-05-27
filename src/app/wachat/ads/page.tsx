'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Plus,
  CreditCard,
  Building2,
  Megaphone,
} from 'lucide-react';
import { Alert, ZoruAlertDescription, ZoruAlertTitle, zoruSonnerToast } from '@/components/zoruui';

import { getAdAccounts } from '@/app/actions/ad-manager.actions';
import type { AdAccount } from '@/lib/definitions';

import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const STORAGE_KEY = 'wachat:whatsapp-ads:adAccountId';

export default function WachatAdAccountProvisioningPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdAccounts();
      if (res.error) setError(res.error);
      else setAccounts(res.accounts || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch ad accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleLinkAccount = (account: AdAccount) => {
    startTransition(() => {
      try { window.localStorage.setItem(STORAGE_KEY, account.id); } catch { /* ignore */ }
      zoruSonnerToast.success(`Ad account ${account.name} linked successfully.`);
      router.push('/wachat/whatsapp-ads');
    });
  };

  return (
    <WaPage>
      <PageHeader
        title="Ad account provisioning"
        description="Connect a Meta ad account so SabNode can launch click-to-WhatsApp campaigns inside this workspace."
        kicker="Wachat · ads"
        eyebrowIcon={Megaphone}
        actions={
          <>
            <WaButton variant="outline" size="sm" onClick={fetchAccounts} disabled={loading || isPending} leftIcon={RefreshCw}>
              Refresh
            </WaButton>
            <Link href="/api/auth/meta-suite/login">
              <WaButton size="sm" leftIcon={Plus}>Connect new</WaButton>
            </Link>
          </>
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error loading accounts</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {!loading && !error && accounts.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No ad accounts connected"
          description="You need to connect a Meta ad account before launching campaigns."
          action={
            <Link href="/api/auth/meta-suite/login">
              <WaButton>Connect Meta account</WaButton>
            </Link>
          }
        />
      )}

      {loading && accounts.length === 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[240px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-5" />
          ))}
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, i) => (
            <m.li
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
              style={{ boxShadow: '0 0 0 1px transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold tracking-tight text-zinc-950" title={account.name}>
                    {account.name}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500">
                    <CreditCard className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    ID {account.account_id}
                  </p>
                </div>
                {account.account_status === 1 ? (
                  <StatusPill tone="live"><CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />Active</StatusPill>
                ) : (
                  <StatusPill tone="paused">Inactive</StatusPill>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-[12.5px]">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">Currency</p>
                  <p className="mt-0.5 font-semibold text-zinc-900">{account.currency || '-'}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">Created</p>
                  <p className="mt-0.5 font-semibold text-zinc-900">
                    {account.created_time ? new Date(account.created_time).toLocaleDateString('en-IN') : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <WaButton
                  variant="outline"
                  className="w-full"
                  disabled={isPending || account.account_status !== 1}
                  onClick={() => handleLinkAccount(account)}
                  rightIcon={ArrowRight}
                >
                  {isPending ? 'Linking...' : 'Link to project'}
                </WaButton>
              </div>
            </m.li>
          ))}
        </ul>
      )}
    </WaPage>
  );
}
