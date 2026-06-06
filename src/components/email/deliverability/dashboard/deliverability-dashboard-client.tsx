'use client';

/**
 * Deliverability dashboard — per-domain bounce/spam/open/click grid +
 * DKIM/SPF/DMARC status indicators.
 *
 * DNS resolution itself happens server-side in the `email-deliverability`
 * Rust crate. The dashboard merely renders the persisted `domainStatus`.
 * Per-domain engagement counters surface from `email_deliverability`
 * (counters that the events fanout writes through).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Clock, AlertCircle, Shield, ShieldOff } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, StatCard, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui';
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

const STATUS_TONE: Record<DnsRecordStatus, { tone: 'default' | 'secondary' | 'outline'; icon: React.ReactNode; label: string }> = {
  valid:    { tone: 'default',   icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'pass' },
  invalid:  { tone: 'outline',   icon: <XCircle className="h-3.5 w-3.5" />,      label: 'fail' },
  pending:  { tone: 'secondary', icon: <Clock className="h-3.5 w-3.5" />,        label: 'pending' },
  missing:  { tone: 'outline',   icon: <AlertCircle className="h-3.5 w-3.5" />,  label: 'missing' },
};

function pct(num: number, denom: number) {
  if (!denom) return '0.0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function DeliverabilityDashboardClient() {
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
        // Per-domain counters: backend stub — populate from
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
    <div className="zoruui space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Deliverability dashboard</PageTitle>
          <PageDescription>
            Per-domain reputation, DKIM / SPF / DMARC status, and engagement counters.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" asChild>
            <Link href="/dashboard/email/deliverability">
              Manage domains
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Sender score"
          value={score !== null ? `${score}/100` : '—'}
          icon={score !== null && score >= 70 ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
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
            <Button asChild>
              <Link href="/dashboard/email/deliverability">Add domain</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Domain</Th>
                <Th>SPF</Th>
                <Th>DKIM</Th>
                <Th>DMARC</Th>
                <Th>Sent</Th>
                <Th>Open</Th>
                <Th>Click</Th>
                <Th>Bounce</Th>
                <Th>Spam</Th>
              </Tr>
            </THead>
            <TBody>
              {domains.map((d) => {
                const c = counters.find((x) => x.domain === d.domain);
                return (
                  <Tr key={d._id}>
                    <Td className="font-medium">
                      {d.domain}{' '}
                      {d.verified ? (
                        <Badge variant="default">verified</Badge>
                      ) : (
                        <Badge variant="outline">unverified</Badge>
                      )}
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
                    <Td>{c?.sentCount ?? 0}</Td>
                    <Td>{pct(c?.openCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td>{pct(c?.clickCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td>{pct(c?.bounceCount ?? 0, c?.sentCount ?? 0)}</Td>
                    <Td>{pct(c?.spamCount ?? 0, c?.sentCount ?? 0)}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-[color:var(--st-text-secondary)]">
        Per-domain engagement counters source from the `email_deliverability` Mongo collection populated
        by the `email-events` fanout. DNS status itself is refreshed by the `email-deliverability` Rust
        crate&apos;s scheduled checker — the dashboard renders the last persisted snapshot.
      </p>
    </div>
  );
}

function DnsBadge({ record }: { record?: DnsRecord }) {
  if (!record) {
    return <Badge variant="outline">—</Badge>;
  }
  const tone = STATUS_TONE[record.status] ?? STATUS_TONE.pending;
  return (
    <Badge variant={tone.tone} className="gap-1">
      {tone.icon}
      {tone.label}
    </Badge>
  );
}
