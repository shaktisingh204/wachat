'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Separator,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Plus,
  CreditCard,
  Building2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import { getAdAccounts } from '@/app/actions/ad-manager.actions';
import type { AdAccount } from '@/lib/definitions';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const STORAGE_KEY = 'wachat:whatsapp-ads:adAccountId';

export default function WachatAdAccountProvisioningPage() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdAccounts();
      if (res.error) {
        setError(res.error);
      } else {
        setAccounts(res.accounts || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch ad accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleLinkAccount = (account: AdAccount) => {
    startTransition(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, account.id);
      } catch (err) {
        // ignore storage errors
      }

      toast({
        title: 'Ad Account linked',
        description: `Ad Account ${account.name} linked successfully.`,
      });
      router.push('/wachat/whatsapp-ads');
    });
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Ads Provisioning' },
      ]}
      title="Ad Account Provisioning"
      description="Connect your Meta Ad Account to run Click-to-WhatsApp Ads directly from SabNode."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={() => fetchAccounts()}
            disabled={loading || isPending}
          >
            Refresh
          </Button>
          <Link href="/api/auth/meta-suite/login">
            <Button size="sm" variant="primary" iconLeft={Plus}>
              Connect New
            </Button>
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <Alert tone="danger" title="Error Loading Accounts">
            {error}
          </Alert>
        )}

        {!loading && !error && accounts.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No Ad Accounts Connected"
            description="You need to connect a Meta Ad Account before you can launch campaigns."
            action={
              <Link href="/api/auth/meta-suite/login">
                <Button variant="primary">Connect Meta Account</Button>
              </Link>
            }
          />
        )}

        {loading && accounts.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} padding="lg" className="flex flex-col gap-4">
                <Skeleton height={24} width="75%" />
                <Skeleton height={16} width="50%" />
                <div className="flex gap-2 mt-auto pt-4">
                  <Skeleton height={36} width="100%" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card key={account.id} padding="none" className="flex flex-col">
                <CardHeader className="flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle
                        className="font-semibold text-lg line-clamp-1"
                        title={account.name}
                      >
                        {account.name}
                      </CardTitle>
                      <CardDescription className="text-sm flex items-center gap-1.5 mt-1">
                        <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        ID: {account.account_id}
                      </CardDescription>
                    </div>
                    {account.account_status === 1 ? (
                      <Badge
                        tone="success"
                        className="shrink-0 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Active
                      </Badge>
                    ) : (
                      <Badge tone="neutral" className="shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  <CardBody className="mt-4 px-0 pb-0 pt-0">
                    <Separator className="mb-4" />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider font-medium mb-1 text-[var(--st-text-tertiary)]">
                          Currency
                        </p>
                        <p className="font-medium text-[var(--st-text)]">
                          {account.currency || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider font-medium mb-1 text-[var(--st-text-tertiary)]">
                          Created
                        </p>
                        <p className="font-medium text-[var(--st-text)]">
                          {account.created_time
                            ? new Date(account.created_time).toLocaleDateString()
                            : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </CardHeader>

                <CardFooter className="mt-auto">
                  <Button
                    block
                    variant="outline"
                    loading={isPending}
                    iconRight={isPending ? undefined : ArrowRight}
                    disabled={isPending || account.account_status !== 1}
                    onClick={() => handleLinkAccount(account)}
                  >
                    Link to Project
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </WachatPage>
  );
}
