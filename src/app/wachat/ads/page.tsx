'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Badge,
  zoruSonnerToast,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from '@/components/zoruui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

import { getAdAccounts } from '@/app/actions/ad-manager.actions';
import type { AdAccount } from '@/lib/definitions';

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
      
      zoruSonnerToast.success(`Ad Account ${account.name} linked successfully.`);
      router.push('/wachat/whatsapp-ads');
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-6xl mx-auto">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Ads Provisioning</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <ZoruPageHeading>
              <div className="flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-zoru-ink/70" />
                <ZoruPageTitle>Ad Account Provisioning</ZoruPageTitle>
              </div>
            </ZoruPageHeading>
            <ZoruPageDescription>
              Connect your Meta Ad Account to run Click-to-WhatsApp Ads directly from SabNode.
            </ZoruPageDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAccounts()}
              disabled={loading || isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/api/auth/meta-suite/login">
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Connect New
              </Button>
            </Link>
          </div>
        </div>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <ZoruAlertTitle>Error Loading Accounts</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {!loading && !error && accounts.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No Ad Accounts Connected"
          description="You need to connect a Meta Ad Account before you can launch campaigns."
          action={
            <Link href="/api/auth/meta-suite/login">
              <Button>
                Connect Meta Account
              </Button>
            </Link>
          }
        />
      )}

      {loading && accounts.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 flex flex-col gap-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 mt-auto pt-4">
                <Skeleton className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="flex flex-col">
              <div className="p-5 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1" title={account.name}>
                      {account.name}
                    </h3>
                    <p className="text-sm text-zoru-ink-muted flex items-center gap-1.5 mt-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      ID: {account.account_id}
                    </p>
                  </div>
                  {account.account_status === 1 ? (
                    <Badge variant="success" className="shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      Inactive
                    </Badge>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zoru-ink-muted text-xs uppercase tracking-wider font-medium mb-1">Currency</p>
                    <p className="font-medium">{account.currency || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-zoru-ink-muted text-xs uppercase tracking-wider font-medium mb-1">Created</p>
                    <p className="font-medium">
                      {account.created_time 
                        ? new Date(account.created_time).toLocaleDateString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-5 pt-0 mt-auto">
                <Button 
                  className="w-full group" 
                  variant="outline"
                  disabled={isPending || account.account_status !== 1}
                  onClick={() => handleLinkAccount(account)}
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      Link to Project
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
