'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Skeleton,
  useZoruToast,
  Input,
} from '@/components/sabcrm/20ui/compat';
import { useTransition, useState, useMemo, useEffect } from 'react';
import {
  LoaderCircle,
  Trash2,
  CheckCircle,
  Copy,
  AlertTriangle,
  Globe,
  Search,
} from 'lucide-react';
import { verifyCustomDomain, deleteCustomDomain } from '@/app/actions/url-shortener.actions';
import type { WithId, CustomDomain } from '@/lib/definitions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

function VerifyButton({ domainId, onActionComplete }: { domainId: string; onActionComplete: () => void }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const onVerify = () => {
    startTransition(async () => {
      const result = await verifyCustomDomain(domainId);
      if (result.success) {
        toast({ title: 'Domain Verified!', description: 'You can now use this domain for your short links.' });
        onActionComplete();
      } else {
        toast({ title: 'Verification Failed', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Button onClick={onVerify} size="sm" disabled={isPending}>
      {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      Verify DNS
    </Button>
  );
}

function DeleteButton({ domainId, onActionComplete }: { domainId: string; onActionComplete: () => void }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const onDelete = () => {
    if (!confirm('Are you sure you want to delete this custom domain?')) return;
    
    startTransition(async () => {
      const result = await deleteCustomDomain(domainId);
      if (result.success) {
        toast({ title: 'Success', description: 'Domain deleted.' });
        onActionComplete();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Button variant="ghost" size="icon" onClick={onDelete} disabled={isPending}>
      {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-zoru-danger-ink" />}
    </Button>
  );
}

export function DomainList({
  domains,
  isLoading,
  onRefresh,
}: {
  domains: WithId<CustomDomain>[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { copy } = useCopyToClipboard();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  // Real-time polling
  useEffect(() => {
    const unverifiedDomains = domains.some((d) => !d.verified);
    if (unverifiedDomains) {
      const intervalId = setInterval(() => {
        onRefresh();
      }, 15000); // Check every 15s if there are unverified domains
      return () => clearInterval(intervalId);
    }
  }, [domains, onRefresh]);

  const filteredDomains = useMemo(() => {
    return domains
      .filter((d) => d.hostname.toLowerCase().includes(search.toLowerCase()))
      .filter((d) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'verified') return d.verified;
        return !d.verified;
      })
      .sort((a, b) => a.hostname.localeCompare(b.hostname)); // sorting alphabetically
  }, [domains, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h4 className="text-zoru-ink font-semibold">Your Domains</h4>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
            <Input
              type="text"
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="h-10 px-3 py-2 rounded-md border border-zoru-line bg-transparent text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filteredDomains.length > 0 ? (
        filteredDomains.map((domain) => (
          <div
            key={domain._id.toString()}
            className="p-4 border border-zoru-line rounded-lg space-y-4 bg-zoru-bg"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <p className="text-lg text-zoru-ink font-medium">{domain.hostname}</p>
                {domain.verified ? (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="danger">Unverified</Badge>
                )}
              </div>
              <DeleteButton domainId={domain._id.toString()} onActionComplete={onRefresh} />
            </div>

            {!domain.verified && (
              <Alert className="border-zoru-warning/40 bg-zoru-warning/10">
                <AlertTriangle className="h-4 w-4 text-zoru-warning-ink" />
                <ZoruAlertTitle className="text-zoru-warning-ink">Action Required: Verify Domain Ownership</ZoruAlertTitle>
                <ZoruAlertDescription className="text-zoru-warning-ink mt-2">
                  Please add a <strong>TXT record</strong> to your DNS configuration to verify you own this domain.
                  <div className="mt-3 p-3 bg-zoru-bg rounded border border-zoru-warning/40 flex items-center justify-between gap-4">
                    <code className="font-mono text-xs break-all">{domain.verificationCode}</code>
                    <Button variant="ghost" size="sm" onClick={() => copy(domain.verificationCode)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs mt-2">After adding the record, click 'Verify DNS'. Record propagation usually takes a few minutes.</p>
                </ZoruAlertDescription>
              </Alert>
            )}

            {domain.verified ? (
              <div className="p-3 bg-zoru-success/10 rounded-md text-sm space-y-3 border border-zoru-success/40">
                <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                  <span className="text-zoru-ink-muted">DNS Status:</span>{' '}
                  <span className="text-zoru-success-ink">Active & Verified</span>
                  <span className="text-zoru-ink-muted">Usage:</span>{' '}
                  <span>Use this domain when creating new short links.</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-2">
                <VerifyButton domainId={domain._id.toString()} onActionComplete={onRefresh} />
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-10 bg-zoru-surface-2 rounded-lg border border-dashed border-zoru-line">
          <Globe className="h-10 w-10 mx-auto text-zoru-ink-muted mb-3" />
          <p className="text-sm font-medium text-zoru-ink">No domains found</p>
          <p className="text-xs text-zoru-ink-muted mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Add a custom domain to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
