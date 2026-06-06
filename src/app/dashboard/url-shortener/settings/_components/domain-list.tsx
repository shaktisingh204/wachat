'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Button, Skeleton, useToast, Input } from '@/components/sabcrm/20ui/compat';
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
  const { toast } = useToast();

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
  const { toast } = useToast();

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
      {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />}
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
        <h4 className="text-[var(--st-text)] font-semibold">Your Domains</h4>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input
              type="text"
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="h-10 px-3 py-2 rounded-md border border-[var(--st-border)] bg-transparent text-sm"
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
            className="p-4 border border-[var(--st-border)] rounded-lg space-y-4 bg-[var(--st-bg)]"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <p className="text-lg text-[var(--st-text)] font-medium">{domain.hostname}</p>
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
              <Alert className="border-[var(--st-warn)]/40 bg-[var(--st-warn)]/10">
                <AlertTriangle className="h-4 w-4 text-[var(--st-warn)]" />
                <AlertTitle className="text-[var(--st-warn)]">Action Required: Verify Domain Ownership</AlertTitle>
                <AlertDescription className="text-[var(--st-warn)] mt-2">
                  Please add a <strong>TXT record</strong> to your DNS configuration to verify you own this domain.
                  <div className="mt-3 p-3 bg-[var(--st-bg)] rounded border border-[var(--st-warn)]/40 flex items-center justify-between gap-4">
                    <code className="font-mono text-xs break-all">{domain.verificationCode}</code>
                    <Button variant="ghost" size="sm" onClick={() => copy(domain.verificationCode)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs mt-2">After adding the record, click 'Verify DNS'. Record propagation usually takes a few minutes.</p>
                </AlertDescription>
              </Alert>
            )}

            {domain.verified ? (
              <div className="p-3 bg-[var(--st-status-ok)]/10 rounded-md text-sm space-y-3 border border-[var(--st-status-ok)]/40">
                <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                  <span className="text-[var(--st-text-secondary)]">DNS Status:</span>{' '}
                  <span className="text-[var(--st-status-ok)]">Active & Verified</span>
                  <span className="text-[var(--st-text-secondary)]">Usage:</span>{' '}
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
        <div className="text-center py-10 bg-[var(--st-bg-muted)] rounded-lg border border-dashed border-[var(--st-border)]">
          <Globe className="h-10 w-10 mx-auto text-[var(--st-text-secondary)] mb-3" />
          <p className="text-sm font-medium text-[var(--st-text)]">No domains found</p>
          <p className="text-xs text-[var(--st-text-secondary)] mt-1">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Add a custom domain to get started.'}
          </p>
        </div>
      )}
    </div>
  );
}
