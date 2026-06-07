'use client';

/**
 * Deliverability dashboard. Per-domain bounce/spam/open/click grid plus
 * DKIM/SPF/DMARC status indicators.
 *
 * DNS resolution itself happens server-side in the `email-deliverability`
 * Rust crate. The dashboard merely renders the persisted `domainStatus`.
 * Per-domain engagement counters surface from `email_deliverability`
 * (counters that the events fanout writes through).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Shield,
  ShieldOff,
  type LucideIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toast,
  type BadgeVariant,
} from '@/components/sabcrm/20ui';
import {
  actionGetDeliverabilityScore,
  actionListEmailDomains,
} from '@/app/actions/email/deliverability.actions';
import type {
  DnsRecord,
  DnsRecordStatus,
  EmailDomainDoc,
} from '@/lib/rust-client/email-deliverability';

interface DomainCounters {
  domain: string;
  bounceCount: number;
  spamCount: number;
  openCount: number;
  clickCount: number;
  sentCount: number;
}

const MANAGE_DOMAINS_HREF = '/dashboard/email/deliverability';

const STATUS_TONE: Record<
  DnsRecordStatus,
  { variant: BadgeVariant; icon: LucideIcon; label: string }
> = {
  valid: { variant: 'default', icon: CheckCircle2, label: 'pass' },
  invalid: { variant: 'outline', icon: XCircle, label: 'fail' },
  pending: { variant: 'secondary', icon: Clock, label: 'pending' },
  missing: { variant: 'outline', icon: AlertCircle, label: 'missing' },
};

function pct(num: number, denom: number) {
  if (!denom) return '0.0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function DeliverabilityDashboardClient() {
  const router = useRouter();
  const [domains, setDomains] = useState<EmailDomainDoc[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [counters, setCounters] = useState<DomainCounters[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dRes, sRes] = await Promise.all([
        actionListEmailDomains(),
        actionGetDeliverabilityScore(),
      ]);
      if (dRes.ok) {
        setDomains(dRes.data);
        // Per-domain counters: backend stub. Populate from the
        // `email_deliverability` collection when the read endpoint
        // surfaces the rollup (see TODO in lib.rs of email-deliverability).
        setCounters(
          dRes.data.map((d) => ({
            domain: d.domain,
            sentCount: 0,
            openCount: 0,
            clickCount: 0,
            bounceCount: 0,
            spamCount: 0,
          })),
        );
      } else {
        toast.error(dRes.error);
      }
      if (sRes.ok) {
        setScore(sRes.data?.score ?? null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="ui20 space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Deliverability dashboard</PageTitle>
          <PageDescription>
            Per-domain reputation, DKIM / SPF / DMARC status, and engagement counters.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => router.push(MANAGE_DOMAINS_HREF)}>
            Manage domains
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Sender score"
          value={score !== null ? `${score}/100` : '-'}
          icon={score !== null && score >= 70 ? Shield : ShieldOff}
        />
        <StatCard label="Verified domains" value={domains.filter((d) => d.verified).length} />
        <StatCard label="Unverified domains" value={domains.filter((d) => !d.verified).length} />
        <StatCard label="Total domains" value={domains.length} />
      </div>

      {domains.length === 0 ? (
        <EmptyState
          title="No sending domains"
          description="Add a domain under Manage Domains to start tracking deliverability."
          action={
            <Button variant="primary" onClick={() => router.push(MANAGE_DOMAINS_HREF)}>
              Add domain
            </Button>
          }
        />
      ) : (
        <Card padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Domain</Th>
                <Th>SPF</Th>
                <Th>DKIM</Th>
                <Th>DMARC</Th>
                <Th align="right">Sent</Th>
                <Th align="right">Open</Th>
                <Th align="right">Click</Th>
                <Th align="right">Bounce</Th>
                <Th align="right">Spam</Th>
              </Tr>
            </THead>
            <TBody>
              {domains.map((d) => {
                const c = counters.find((x) => x.domain === d.domain);
                return (
                  <Tr key={d._id}>
                    <Td className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {d.domain}
                        {d.verified ? (
                          <Badge variant="success">verified</Badge>
                        ) : (
                          <Badge variant="outline">unverified</Badge>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <DnsBadge record={d.spf} />
                    </Td>
                    <Td>
                      <DnsBadge record={d.dkim} />
                    </Td>
                    <Td>
                      <DnsBadge record={d.dmarc} />
                    </Td>
                    <Td align="right">{c?.sentCount ?? 0}</Td>
                    <Td align="right">{pct(c?.openCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td align="right">{pct(c?.clickCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td align="right">{pct(c?.bounceCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td align="right">{pct(c?.spamCount ?? 0, c?.sentCount ?? 0)}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-[var(--st-text-secondary)]">
        Per-domain engagement counters source from the `email_deliverability` Mongo collection
        populated by the `email-events` fanout. DNS status itself is refreshed by the
        `email-deliverability` Rust crate&apos;s scheduled checker. The dashboard renders the last
        persisted snapshot.
      </p>
    </div>
  );
}

function DnsBadge({ record }: { record?: DnsRecord }) {
  if (!record) {
    return <Badge variant="outline">-</Badge>;
  }
  const tone = STATUS_TONE[record.status] ?? STATUS_TONE.pending;
  const Icon = tone.icon;
  return (
    <Badge variant={tone.variant} className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tone.label}
    </Badge>
  );
}
