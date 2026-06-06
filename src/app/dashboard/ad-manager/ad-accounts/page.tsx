'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Trash2,
  Plus,
  Megaphone,
  ExternalLink,
  TriangleAlert,
  Info,
  ShieldCheck,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Dot,
  EmptyState,
  IconButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';

import { useAdManager } from '@/context/ad-manager-context';
import {
  getAdAccounts,
  deleteAdAccount,
  getAdAccountDetails,
} from '@/app/actions/ad-manager.actions';

import {
  AmBreadcrumb,
  AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';

/**
 * /dashboard/ad-manager/ad-accounts. Manage connected Meta ad accounts.
 *
 * 20ui rewrite. Select, disconnect, or connect new Meta ad accounts.
 */

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

/* loading skeleton */

function PageSkeleton() {
  return (
    <>
      <div className="h-4 w-48 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
      <div className="mt-5">
        <div className="h-7 w-40 animate-pulse rounded bg-[var(--st-bg-muted)]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--st-bg-muted)]" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} padding="none">
            <div className="p-5">
              <div className="h-5 w-36 animate-pulse rounded bg-[var(--st-bg-muted)]" />
              <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-[var(--st-bg-muted)]" />
            </div>
            <div className="border-t border-[var(--st-border)] px-5 py-3">
              <div className="h-8 w-24 animate-pulse rounded-full bg-[var(--st-bg-muted)]" />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* disconnect confirmation dialog */

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
      <DialogTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          icon={Trash2}
          label={`Disconnect ${account.name}`}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Disconnect ad account?</DialogTitle>
          <DialogDescription>
            Are you sure you want to disconnect{' '}
            <strong className="text-[var(--st-text)]">{account.name}</strong>? This
            will remove it from your dashboard but will not affect the account
            on Facebook.
          </DialogDescription>
        </DialogHeader>

        <Alert tone="warning" icon={TriangleAlert}>
          You will need to re-connect via Facebook to access this account again.
        </Alert>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={isDeleting}
            onClick={handleConfirm}
          >
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* account card */

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
      variant="interactive"
      padding="none"
      className={cn(
        'group cursor-pointer',
        isActive && 'ring-2 ring-[var(--st-accent)]/20',
      )}
      onClick={onSelect}
    >
      {/* Card body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-[var(--st-text)]">
                {account.name}
              </h3>
              {isActive && (
                <Badge variant="info" className="shrink-0">
                  Active
                </Badge>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] tracking-wide text-[var(--st-text-secondary)]">
              {account.account_id}
            </p>
          </div>

          {/* Status dot */}
          <Dot
            tone={isActive ? 'accent' : 'neutral'}
            pulse={isActive}
            className="mt-1 shrink-0"
            aria-label={isActive ? 'Active account' : 'Inactive account'}
          />
        </div>

        {/* Meta tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            <ShieldCheck className="mr-0.5 h-3 w-3" aria-hidden="true" />
            Connected
          </Badge>
          {account.currency && (
            <Badge variant="secondary">{account.currency}</Badge>
          )}
          {/* Account health indicator */}
          <Badge variant={account.account_status === 1 ? 'success' : 'secondary'}>
            {account.account_status === 1
              ? 'Active'
              : account.account_status === 2
                ? 'Disabled'
                : 'Unknown'}
          </Badge>
        </div>
        {/* Last used timestamp */}
        {account.last_used_time && (
          <p className="mt-2 text-[10px] text-[var(--st-text-secondary)]">
            Last used: {new Date(account.last_used_time).toLocaleString()}
          </p>
        )}
        {!account.last_used_time && account.created_time && (
          <p className="mt-2 text-[10px] text-[var(--st-text-secondary)]">
            Created: {new Date(account.created_time).toLocaleString()}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between border-t border-[var(--st-border)] px-5 py-3">
        <Button
          variant={isActive ? 'primary' : 'outline'}
          size="sm"
          iconLeft={Megaphone}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isActive ? 'Manage campaigns' : 'Select account'}
        </Button>

        <div className="flex items-center gap-1">
          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.account_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              variant="ghost"
              size="sm"
              icon={ExternalLink}
              label="View on Facebook"
            />
          </a>
          <div onClick={(e) => e.stopPropagation()}>
            <DisconnectDialog account={account} onDisconnect={onDisconnect} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* empty state */

function AdAccountsEmptyState() {
  return (
    <Card padding="lg" className="border-2 border-dashed border-[var(--st-border)]">
      <EmptyState
        icon={Megaphone}
        title="No ad accounts connected"
        description="Connect your Facebook Ad Account to start creating and managing campaigns directly from SabNode."
        action={
          <Link href="/api/auth/ad-manager/login">
            <Button variant="primary" size="md" iconLeft={Plus}>
              Connect ad account
            </Button>
          </Link>
        }
      />
    </Card>
  );
}

/* info note */

function InfoCard() {
  return (
    <Alert tone="info" icon={Info} title="How to connect accounts">
      When you click &ldquo;Connect ad account&rdquo;, you will be redirected to
      Facebook to authorize SabNode. Make sure you have admin access to the ad
      accounts you want to connect. You can manage permissions anytime from{' '}
      <a
        href="https://business.facebook.com/settings/ad-accounts"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--st-text)] hover:underline"
      >
        Meta Business Settings
      </a>
      .
    </Alert>
  );
}

/* page */

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
          tone: 'danger',
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
        tone: 'success',
      });
    } else {
      toast({
        title: 'Sync finished with errors',
        description: `Failed to refresh ${errorCount} account(s).`,
        tone: 'danger',
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
      tone: 'success',
    });
    router.push('/dashboard/ad-manager/campaigns');
  };

  const handleDisconnect = async (accountId: string) => {
    const res = await deleteAdAccount(accountId);
    if (res.success) {
      toast({
        title: 'Account disconnected',
        description: 'The ad account has been removed.',
        tone: 'success',
      });
      if (activeAccount?.id === accountId) {
        selectAccount(null);
      }
      fetchAccounts();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        tone: 'danger',
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
            <Button
              variant="outline"
              size="md"
              loading={isPageLoading || isSyncing}
              onClick={handleBulkSync}
              disabled={isPageLoading || isSyncing || accounts.length === 0}
            >
              Sync Accounts
            </Button>
            <Link href="/api/auth/ad-manager/login" className="shrink-0">
              <Button variant="primary" size="md" iconLeft={Plus}>
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
            <AdAccountsEmptyState />
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

            {/* Info note */}
            <InfoCard />
          </div>
        )}
      </div>
    </>
  );
}
