'use client';

/**
 * /dashboard/ad-manager/ad-accounts — Manage connected Meta ad accounts.
 *
 * Clay design system rewrite.
 * Select, disconnect, or connect new Meta ad accounts.
 */

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LuTrash2,
  LuPlus,
  LuMegaphone,
  LuExternalLink,
  LuLoaderCircle,
  LuTriangleAlert,
  LuInfo,
  LuShieldCheck,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { getAdAccounts, deleteAdAccount } from '@/app/actions/ad-manager.actions';
import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayBadge,
} from '@/components/clay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

/* ── loading skeleton ──────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <>
      <div className="h-4 w-48 animate-pulse rounded-full bg-clay-bg-2" />
      <div className="mt-5">
        <div className="h-7 w-40 animate-pulse rounded bg-clay-bg-2" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-clay-bg-2" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ClayCard key={i} className="!p-0">
            <div className="p-5">
              <div className="h-5 w-36 animate-pulse rounded bg-clay-bg-2" />
              <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-clay-bg-2" />
            </div>
            <div className="border-t border-clay-border px-5 py-3">
              <div className="h-8 w-24 animate-pulse rounded-full bg-clay-bg-2" />
            </div>
          </ClayCard>
        ))}
      </div>
    </>
  );
}

/* ── disconnect confirmation dialog ────────────────────────────── */

function DisconnectDialog({
  account,
  onDisconnect,
}: {
  account: any;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const handleConfirm = () => {
    startDelete(async () => {
      await onDisconnect();
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ClayButton
          variant="ghost"
          size="icon"
          className="text-clay-ink-muted hover:text-clay-red"
          aria-label={`Disconnect ${account.name}`}
        >
          <LuTrash2 className="h-3.5 w-3.5" />
        </ClayButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold text-clay-ink">
            Disconnect ad account?
          </DialogTitle>
          <DialogDescription className="text-[13px] text-clay-ink-muted">
            Are you sure you want to disconnect{' '}
            <strong className="text-clay-ink">{account.name}</strong>? This
            will remove it from your dashboard but will not affect the account
            on Facebook.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-clay-lg bg-clay-red-soft/40 p-3.5 text-[12px] text-clay-red">
          <LuTriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            You will need to re-connect via Facebook to access this account
            again.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <ClayButton
            variant="pill"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </ClayButton>
          <ClayButton
            variant="rose"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            leading={
              isDeleting ? (
                <LuLoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : undefined
            }
          >
            Disconnect
          </ClayButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── account card ──────────────────────────────────────────────── */

function AccountCard({
  account,
  isActive,
  onSelect,
  onDisconnect,
}: {
  account: any;
  isActive: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <ClayCard
      padded={false}
      className={cn(
        'group cursor-pointer transition-all duration-200',
        isActive
          ? 'border-indigo-500 ring-2 ring-indigo-500/15'
          : 'hover:border-clay-border-strong hover:shadow-clay-float',
      )}
      onClick={onSelect}
    >
      {/* Card body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-clay-ink">
                {account.name}
              </h3>
              {isActive && (
                <ClayBadge tone="blue" dot className="shrink-0">
                  Active
                </ClayBadge>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-clay-ink-muted tracking-wide">
              {account.account_id}
            </p>
          </div>

          {/* Status dot */}
          <span
            className={cn(
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              isActive ? 'bg-emerald-500' : 'bg-clay-ink-soft/30',
            )}
          />
        </div>

        {/* Meta tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ClayBadge tone="neutral">
            <LuShieldCheck className="mr-0.5 h-3 w-3" />
            Connected
          </ClayBadge>
          {account.currency && (
            <ClayBadge tone="neutral">{account.currency}</ClayBadge>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between border-t border-clay-border px-5 py-3">
        <ClayButton
          variant={isActive ? 'obsidian' : 'pill'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          leading={<LuMegaphone className="h-3 w-3" />}
        >
          {isActive ? 'Manage campaigns' : 'Select account'}
        </ClayButton>

        <div className="flex items-center gap-1">
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <ClayButton
              variant="ghost"
              size="icon"
              className="text-clay-ink-muted hover:text-clay-ink"
              aria-label="View on Facebook"
            >
              <LuExternalLink className="h-3.5 w-3.5" />
            </ClayButton>
          </a>
          <div onClick={(e) => e.stopPropagation()}>
            <DisconnectDialog account={account} onDisconnect={onDisconnect} />
          </div>
        </div>
      </div>
    </ClayCard>
  );
}

/* ── empty state ───────────────────────────────────────────────── */

function EmptyState() {
  return (
    <ClayCard
      variant="soft"
      className="flex flex-col items-center justify-center gap-5 border-2 border-dashed border-clay-border py-16 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <LuMegaphone className="h-7 w-7 text-indigo-600" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="text-[16px] font-semibold text-clay-ink">
          No ad accounts connected
        </h3>
        <p className="mt-1.5 max-w-md text-[13px] text-clay-ink-muted leading-relaxed">
          Connect your Facebook Ad Account to start creating and managing
          campaigns directly from SabNode.
        </p>
      </div>
      <Link href="/api/auth/ad-manager/login">
        <ClayButton
          variant="obsidian"
          size="md"
          leading={<LuPlus className="h-3.5 w-3.5" />}
        >
          Connect ad account
        </ClayButton>
      </Link>
    </ClayCard>
  );
}

/* ── info card ─────────────────────────────────────────────────── */

function InfoCard() {
  return (
    <ClayCard variant="soft" className="!p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <LuInfo className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-clay-ink">
            How to connect accounts
          </p>
          <p className="mt-1 text-[12px] text-clay-ink-muted leading-relaxed">
            When you click "Connect ad account", you will be redirected to
            Facebook to authorize SabNode. Make sure you have admin access to the
            ad accounts you want to connect. You can manage permissions anytime
            from{' '}
            <a
              href="https://business.facebook.com/settings/ad-accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 hover:underline"
            >
              Meta Business Settings
            </a>
            .
          </p>
        </div>
      </div>
    </ClayCard>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function AdAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isPageLoading, startPageLoad] = useTransition();
  const { activeAccount, selectAccount } = useAdManager();
  const { toast } = useToast();
  const router = useRouter();

  const fetchAccounts = () => {
    startPageLoad(async () => {
      const { accounts: data, error } = await getAdAccounts();
      if (error) {
        toast({
          title: 'Error fetching accounts',
          description: error,
          variant: 'destructive',
        });
      } else {
        setAccounts(data || []);
      }
    });
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (account: any) => {
    selectAccount({
      id: account.id,
      name: account.name,
      account_id: account.account_id || account.id?.replace(/^act_/, ''),
    });
    toast({
      title: 'Account selected',
      description: `Now managing ${account.name}`,
    });
    router.push('/dashboard/ad-manager/campaigns');
  };

  const handleDisconnect = async (accountId: string) => {
    const res = await deleteAdAccount(accountId);
    if (res.success) {
      toast({
        title: 'Account disconnected',
        description: 'The ad account has been removed.',
      });
      if (activeAccount?.id === accountId) {
        selectAccount(null);
      }
      fetchAccounts();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  /* Loading state */
  if (isPageLoading && accounts.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <>
      {/* Breadcrumbs */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Meta Suite', href: '/dashboard/ad-manager' },
          { label: 'Ad Accounts' },
        ]}
      />

      {/* Header */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.15]">
            Ad Accounts
          </h1>
          <p className="mt-1 text-[13px] text-clay-ink-muted">
            Connect and manage your Meta ad accounts to run campaigns.
          </p>
        </div>
        <Link href="/api/auth/ad-manager/login" className="shrink-0">
          <ClayButton
            variant="obsidian"
            size="md"
            leading={<LuPlus className="h-3.5 w-3.5" />}
          >
            Connect account
          </ClayButton>
        </Link>
      </div>

      {/* Content */}
      <div className="mt-6">
        {accounts.length === 0 ? (
          <div className="space-y-5">
            <EmptyState />
            <InfoCard />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Account grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  isActive={activeAccount?.id === acc.id}
                  onSelect={() => handleSelect(acc)}
                  onDisconnect={() => handleDisconnect(acc.id)}
                />
              ))}
            </div>

            {/* Info card */}
            <InfoCard />
          </div>
        )}
      </div>
    </>
  );
}
