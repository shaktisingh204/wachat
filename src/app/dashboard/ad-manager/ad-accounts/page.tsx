'use client';

import {
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trash2,
  Plus,
  Megaphone,
  ExternalLink,
  LoaderCircle,
  TriangleAlert,
  Info,
  ShieldCheck,
  } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAdManager } from '@/context/ad-manager-context';
import { 
  getAdAccounts,
  deleteAdAccount,
  getAdAccountDetails 
} from '@/app/actions/ad-manager.actions';

/**
 * /dashboard/ad-manager/ad-accounts — Manage connected Meta ad accounts.
 *
 * ZoruUI rewrite.
 * Select, disconnect, or connect new Meta ad accounts.
 */

import * as React from 'react';

import {
  AmBreadcrumb,
  AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';

export interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  currency?: string;
  account_status?: number;
  last_used_time?: string;
  created_time?: string;
  timezone_name?: string;
  business_country_code?: string;
  amount_spent?: string;
  balance?: string;
  spend_cap?: string;
  disable_reason?: number;
  min_daily_budget?: number;
  min_campaign_group_spend_cap?: number;
  age?: number;
  is_prepay_account?: boolean;
}

/* ── loading skeleton ──────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <>
      <div className="h-4 w-48 animate-pulse rounded-full bg-muted" />
      <div className="mt-5">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="!p-0">
            <div className="p-5">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="border-t border-border px-5 py-3">
              <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
            </div>
          </Card>
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
  account: AdAccount;
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
      <ZoruDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Disconnect ${account.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-[420px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-[16px] font-semibold text-foreground">
            Disconnect ad account?
          </ZoruDialogTitle>
          <ZoruDialogDescription className="text-[13px] text-muted-foreground">
            Are you sure you want to disconnect{' '}
            <strong className="text-foreground">{account.name}</strong>? This
            will remove it from your dashboard but will not affect the account
            on Facebook.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="flex items-center gap-3 rounded-xl bg-rose-50/40 p-3.5 text-[12px] text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            You will need to re-connect via Facebook to access this account
            again.
          </span>
        </div>

        <ZoruDialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Disconnect
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
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
  account: AdAccount;
  isActive: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card
      className={cn(
        'group cursor-pointer p-0 transition-all duration-200',
        isActive
          ? 'border-indigo-500 ring-2 ring-indigo-500/15'
          : 'hover:border-border hover:shadow-md',
      )}
      onClick={onSelect}
    >
      {/* Card body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-foreground">
                {account.name}
              </h3>
              {isActive && (
                <Badge variant="info" className="shrink-0">
                  Active
                </Badge>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground tracking-wide">
              {account.account_id}
            </p>
          </div>

          {/* Status dot */}
          <span
            className={cn(
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30',
            )}
          />
        </div>

        {/* Meta tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            <ShieldCheck className="mr-0.5 h-3 w-3" />
            Connected
          </Badge>
          {account.currency && (
            <Badge variant="secondary">{account.currency}</Badge>
          )}
          {/* Account health indicator */}
          <Badge variant={account.account_status === 1 ? 'success' : 'secondary'}>
            {account.account_status === 1 ? 'Active' : account.account_status === 2 ? 'Disabled' : 'Unknown'}
          </Badge>
        </div>
        {/* Last used timestamp */}
        {account.last_used_time && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Last used: {new Date(account.last_used_time).toLocaleString()}
          </p>
        )}
        {!account.last_used_time && account.created_time && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Created: {new Date(account.created_time).toLocaleString()}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between border-t border-border px-5 py-3">
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <Megaphone className="h-3 w-3" />
          {isActive ? 'Manage campaigns' : 'Select account'}
        </Button>

        <div className="flex items-center gap-1">
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label="View on Facebook"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
          <div onClick={(e) => e.stopPropagation()}>
            <DisconnectDialog account={account} onDisconnect={onDisconnect} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── empty state ───────────────────────────────────────────────── */

function EmptyState() {
  return (
    <Card
      className="flex flex-col items-center justify-center gap-5 border-2 border-dashed border-border py-16 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
        <Megaphone className="h-7 w-7 text-indigo-600" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="text-[16px] font-semibold text-foreground">
          No ad accounts connected
        </h3>
        <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground leading-relaxed">
          Connect your Facebook Ad Account to start creating and managing
          campaigns directly from SabNode.
        </p>
      </div>
      <Link href="/api/auth/ad-manager/login">
        <Button variant="default" size="md">
          <Plus className="h-3.5 w-3.5" />
          Connect ad account
        </Button>
      </Link>
    </Card>
  );
}

/* ── info card ─────────────────────────────────────────────────── */

function InfoCard() {
  return (
    <Card className="!p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <Info className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            How to connect accounts
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
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
    </Card>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function AdAccountsPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [isPageLoading, startPageLoad] = useTransition();
  const { activeAccount, selectAccount } = useAdManager();
  const { toast } = useToast();
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleBulkSync = async () => {
    if (accounts.length === 0) return;
    setIsSyncing(true);
    let errorCount = 0;
    const updatedAccounts = [...accounts];

    for (let i = 0; i < updatedAccounts.length; i++) {
      const acc = updatedAccounts[i];
      const { data, error } = await getAdAccountDetails(acc.id);
      if (data && !error) {
        updatedAccounts[i] = {
          ...acc,
          ...data,
        };
      } else {
        errorCount++;
      }
    }

    setAccounts(updatedAccounts);
    setIsSyncing(false);

    if (errorCount === 0) {
      toast({
        title: 'Sync complete',
        description: 'Successfully refreshed all ad accounts.',
      });
    } else {
      toast({
        title: 'Sync finished with errors',
        description: `Failed to refresh ${errorCount} account(s).`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (account: AdAccount) => {
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
      <AmBreadcrumb page="Ad Accounts" />

      <AmHeader
        title="Ad Accounts"
        description="Connect and manage your Meta ad accounts to run campaigns."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={handleBulkSync} disabled={isPageLoading || isSyncing || accounts.length === 0}>
              <LoaderCircle className={cn("h-3.5 w-3.5", (isPageLoading || isSyncing) && "animate-spin")} />
              Sync Accounts
            </Button>
            <Link href="/api/auth/ad-manager/login" className="shrink-0">
              <Button variant="default" size="md">
                <Plus className="h-3.5 w-3.5" />
                Connect account
              </Button>
            </Link>
          </div>
        }
      />

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
