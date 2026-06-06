'use client';

import { useTransition } from 'react';
import {
  ChevronDown,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ZoruCollapsible,
  ZoruCollapsibleContent,
  ZoruCollapsibleTrigger,
  EmptyState,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  actionCheckEmailDomain,
  actionRotateDkim,
  type EmailDomainDoc,
} from '@/app/actions/email/deliverability.actions';
import type { DnsRecord, DnsRecordStatus } from '@/lib/rust-client/email-deliverability';
import { DnsRecordRow } from './dns-record-row';

interface DomainListProps {
  domains: EmailDomainDoc[];
  onUpdated: () => void;
}

function statusBadge(record: DnsRecord | undefined, fallbackType: string) {
  const tone: Record<DnsRecordStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    valid: 'success',
    pending: 'warning',
    invalid: 'destructive',
    missing: 'destructive',
  };
  return (
    <Badge variant={record ? (tone[record.status] ?? 'secondary') : 'secondary'}>
      {record?.type ?? fallbackType}
    </Badge>
  );
}

export function DomainList({ domains, onUpdated }: DomainListProps) {
  const [pending, startTransition] = useTransition();

  if (domains.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title="No sender domains yet"
        description="Add a domain to your account to begin authenticating outbound mail."
      />
    );
  }

  const handleCheck = (domain: string) => {
    startTransition(async () => {
      const result = await actionCheckEmailDomain(domain);
      if (!result.ok) {
        zoruToast({ title: 'DNS check failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: `Checked ${domain}` });
      onUpdated();
    });
  };

  const handleRotate = (domain: string) => {
    startTransition(async () => {
      const result = await actionRotateDkim(domain);
      if (!result.ok) {
        zoruToast({ title: 'DKIM rotation failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({
        title: 'DKIM rotated',
        description: `New selector: ${result.data.selector}`,
      });
      onUpdated();
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Domain</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Records</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {domains.map((d) => (
            <ZoruTableRow key={d._id}>
              <ZoruTableCell colSpan={4} className="p-0">
                <ZoruCollapsible>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ZoruCollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Toggle DNS records"
                        >
                          <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                        </Button>
                      </ZoruCollapsibleTrigger>
                      <span className="font-medium text-[var(--st-text)]">{d.domain}</span>
                    </div>
                    <div>
                      {d.verified ? (
                        <Badge variant="success">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <ShieldOff className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {statusBadge(d.spf, 'SPF')}
                      {statusBadge(d.dkim, 'DKIM')}
                      {statusBadge(d.dmarc, 'DMARC')}
                      {statusBadge(d.mx, 'MX')}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheck(d.domain)}
                        disabled={pending}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Check now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRotate(d.domain)}
                        disabled={pending}
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Rotate DKIM
                      </Button>
                    </div>
                  </div>
                  <ZoruCollapsibleContent>
                    <div className="space-y-2 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
                      <DnsRecordRow record={d.spf} label="SPF" />
                      <DnsRecordRow record={d.dkim} label={`DKIM${d.dkimSelector ? ` (${d.dkimSelector})` : ''}`} />
                      <DnsRecordRow record={d.dmarc} label="DMARC" />
                      <DnsRecordRow record={d.mx} label="MX" />
                    </div>
                  </ZoruCollapsibleContent>
                </ZoruCollapsible>
              </ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </Table>
    </Card>
  );
}
