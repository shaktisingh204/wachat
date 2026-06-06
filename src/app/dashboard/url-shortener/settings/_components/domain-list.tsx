'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  IconButton,
  Card,
  CardBody,
  EmptyState,
  Skeleton,
  useToast,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { useTransition, useState, useMemo, useEffect } from 'react';
import {
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
        toast({ title: 'Domain verified', description: 'You can now use this domain for your short links.', tone: 'success' });
        onActionComplete();
      } else {
        toast({ title: 'Verification failed', description: result.error, tone: 'danger' });
      }
    });
  };

  return (
    <Button variant="primary" size="sm" onClick={onVerify} loading={isPending}>
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
        toast({ title: 'Domain deleted', tone: 'success' });
        onActionComplete();
      } else {
        toast({ title: 'Could not delete domain', description: result.error, tone: 'danger' });
      }
    });
  };

  return (
    <IconButton
      variant="ghost"
      icon={Trash2}
      label="Delete custom domain"
      onClick={onDelete}
      disabled={isPending}
    />
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
        <h4 className="text-[var(--st-text)] font-semibold">Your domains</h4>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <Input
              type="text"
              placeholder="Search domains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={Search}
              aria-label="Search domains"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as 'all' | 'verified' | 'unverified')}
          >
            <SelectTrigger aria-label="Filter by status" className="w-40">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton height={96} />
          <Skeleton height={96} />
        </div>
      ) : filteredDomains.length > 0 ? (
        filteredDomains.map((domain) => (
          <Card key={domain._id.toString()} variant="outlined" padding="md">
            <CardBody className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <p className="text-lg text-[var(--st-text)] font-medium">{domain.hostname}</p>
                  {domain.verified ? (
                    <Badge tone="success">
                      <CheckCircle className="mr-1 h-3 w-3" aria-hidden="true" /> Verified
                    </Badge>
                  ) : (
                    <Badge tone="danger">Unverified</Badge>
                  )}
                </div>
                <DeleteButton domainId={domain._id.toString()} onActionComplete={onRefresh} />
              </div>

              {!domain.verified && (
                <Alert tone="warning" icon={AlertTriangle}>
                  <AlertTitle>Action required: verify domain ownership</AlertTitle>
                  <AlertDescription className="mt-2">
                    Please add a <strong>TXT record</strong> to your DNS configuration to verify you own this domain.
                    <div className="mt-3 p-3 bg-[var(--st-bg)] rounded-[var(--st-radius)] border border-[var(--st-border)] flex items-center justify-between gap-4">
                      <code className="font-mono text-xs break-all text-[var(--st-text)]">{domain.verificationCode}</code>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={Copy}
                        label="Copy verification code"
                        onClick={() => copy(domain.verificationCode)}
                      />
                    </div>
                    <p className="text-xs mt-2 text-[var(--st-text-secondary)]">
                      After adding the record, click Verify DNS. Record propagation usually takes a few minutes.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {domain.verified ? (
                <div className="p-3 rounded-[var(--st-radius)] text-sm space-y-3 border border-[var(--st-status-ok)]/40 bg-[var(--st-status-ok)]/10">
                  <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs">
                    <span className="text-[var(--st-text-secondary)]">DNS status:</span>{' '}
                    <span className="text-[var(--st-status-ok)]">Active, verified</span>
                    <span className="text-[var(--st-text-secondary)]">Usage:</span>{' '}
                    <span className="text-[var(--st-text)]">Use this domain when creating new short links.</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pt-2">
                  <VerifyButton domainId={domain._id.toString()} onActionComplete={onRefresh} />
                </div>
              )}
            </CardBody>
          </Card>
        ))
      ) : (
        <EmptyState
          icon={Globe}
          title="No domains found"
          description={
            search || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Add a custom domain to get started.'
          }
        />
      )}
    </div>
  );
}
