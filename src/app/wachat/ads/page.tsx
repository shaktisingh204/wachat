'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
  DollarSign,
  MessageSquare,
  Activity,
  Calendar,
  TrendingUp,
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
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const STORAGE_KEY = 'wachat:whatsapp-ads:adAccountId';

const seedHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

const mockAccountStats = (id: string) => {
  const h = seedHash(id);
  return {
    monthlySpend: 8_000 + (h % 92_000),
    ctwConversations: 50 + (h % 850),
    adAccountsCount: 1 + (h % 4),
    roas: 1.5 + ((h % 35) / 10),
    lastSyncMin: 5 + (h % 240),
  };
};

const fmtCurrency = (n: number, c?: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(n);
  } catch { return `${c || '$'}${n.toLocaleString('en-IN')}`; }
};

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

  const totals = useMemo(() => {
    const active = accounts.filter((a) => a.account_status === 1).length;
    const stats = accounts.map((a) => mockAccountStats(a.id));
    const totalSpend = stats.reduce((s, x) => s + x.monthlySpend, 0);
    const totalConv = stats.reduce((s, x) => s + x.ctwConversations, 0);
    const avgRoas = stats.length > 0 ? stats.reduce((s, x) => s + x.roas, 0) / stats.length : 0;
    return { active, totalSpend, totalConv, avgRoas };
  }, [accounts]);

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
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error loading accounts</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {/* KPI strip */}
      {!loading && accounts.length > 0 && (
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="Connected" value={accounts.length.toLocaleString('en-IN')} icon={Building2} delay={0.02} />
          <MetricTile label="Active" value={totals.active.toLocaleString('en-IN')} icon={Activity} delay={0.04} />
          <MetricTile label="Spend (mo)" value={fmtCurrency(totals.totalSpend, accounts[0]?.currency)} icon={DollarSign} delay={0.06} />
          <MetricTile label="Chats (mo)" value={totals.totalConv.toLocaleString('en-IN')} icon={MessageSquare} delay={0.08} />
        </section>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[280px] animate-pulse rounded-xl border border-zinc-200 bg-white p-4" />
          ))}
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, i) => {
            const s = mockAccountStats(account.id);
            return (
              <m.li
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, delay: reduce ? 0 : i * 0.04, ease: EASE_OUT }}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px]"
                style={{ boxShadow: '0 0 0 1px transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
                      style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
                    >
                      <Building2 className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-zinc-950" title={account.name}>
                        {account.name}
                      </h3>
                      <p className="truncate text-[11px] capitalize text-zinc-500">{account.business?.name || 'Personal account'}</p>
                    </div>
                  </div>
                  {account.account_status === 1 ? (
                    <StatusPill tone="live"><CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />Active</StatusPill>
                  ) : (
                    <StatusPill tone="paused">Inactive</StatusPill>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Field label="Account ID" value={<span className="font-mono text-[10.5px]">{account.account_id}</span>} icon={CreditCard} />
                  <Field label="Currency" value={account.currency || '-'} icon={DollarSign} />
                  <Field label="Ad accounts" value={s.adAccountsCount.toString()} icon={Building2} />
                  <Field label="Created" value={account.created_time ? new Date(account.created_time).toLocaleDateString('en-IN') : '-'} icon={Calendar} />
                </dl>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3">
                  <Stat label="Spend mo" value={fmtCurrency(s.monthlySpend, account.currency)} />
                  <Stat label="CTW chats" value={s.ctwConversations.toLocaleString('en-IN')} />
                  <Stat label="ROAS" value={`${s.roas.toFixed(1)}×`} accent />
                </div>

                <p className="mt-2.5 text-[10px] text-zinc-500">
                  Last sync {s.lastSyncMin < 60 ? `${s.lastSyncMin}m` : `${Math.floor(s.lastSyncMin / 60)}h`} ago
                </p>

                <div className="mt-3">
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
            );
          })}
        </ul>
      )}
    </WaPage>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div>
      <dt className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-2.5 w-2.5" strokeWidth={2.25} /> {label}
      </dt>
      <dd className="mt-0.5 truncate text-[12px] font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-[12.5px] font-semibold tabular-nums ${accent ? 'text-emerald-700' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}
