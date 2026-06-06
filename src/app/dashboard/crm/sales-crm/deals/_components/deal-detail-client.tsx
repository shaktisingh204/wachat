'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
} from '@/components/sabcrm/20ui/compat';
import {
  Handshake,
  ListChecks,
  StickyNote,
  LifeBuoy,
  Receipt,
  Paperclip,
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
  User,
  Layers,
  ArrowRightCircle,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { Crm360Timeline } from '@/components/crm/crm-360-timeline';
import { CrmLineageChart } from '@/components/crm/crm-lineage-chart';
import { DealDetailActions } from './deal-detail-actions';
import { DealQuickEdits } from './deal-quick-edits';
import { DealRelatedRail } from './deal-related-rail';

import {
  getCrmEntityTimeline,
  addCrmNote,
} from '@/app/actions/crm.actions';
import { getCrmDealLineage } from '@/app/actions/crm.actions';

interface DealDetailClientProps {
  deal: any;
  dealIdStr: string;
  accountId: string | null;
  contactId: string | null;
  stages: string[];
  amount: number;
  probabilityPct: number | null;
  weighted: number | null;
  dealCurrency: string;
  stageAge: number | null;
  dealAge: number | null;
  dealStatus: string | null;
  contactPrimary: { email: string | null; phone: string | null };
  related: any;
}

export function DealDetailClient({
  deal,
  dealIdStr,
  accountId,
  contactId,
  stages,
  amount,
  probabilityPct,
  weighted,
  dealCurrency,
  stageAge,
  dealAge,
  dealStatus,
  contactPrimary,
  related,
}: DealDetailClientProps) {
  const router = useRouter();
  const [timelineItems, setTimelineItems] = React.useState<any[]>([]);
  const [lineageNodes, setLineageNodes] = React.useState<any[]>([]);
  const [isPending, startTransition] = React.useTransition();

  // Fetch timeline and lineage dynamically
  const fetchDetails = React.useCallback(async () => {
    try {
      const timelineRes = await getCrmEntityTimeline('deal', dealIdStr);
      if (timelineRes.success) {
        setTimelineItems(timelineRes.items);
      }
      const lineageRes = await getCrmDealLineage(dealIdStr);
      if (lineageRes.success) {
        setLineageNodes(lineageRes.nodes);
      }
    } catch (e) {
      console.error('[DealDetailClient] timeline/lineage load failed:', e);
    }
  }, [dealIdStr]);

  React.useEffect(() => {
    startTransition(() => {
      fetchDetails();
    });
  }, [fetchDetails]);

  const handleAddComment = async (body: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', dealIdStr);
    fd.append('recordType', 'deal');
    fd.append('noteContent', body);
    const res = await addCrmNote(null, fd);
    if (fd && !res.error) {
      await fetchDetails();
      return true;
    }
    return false;
  };

  const handleSendWhatsApp = async (templateId: string, phone: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', dealIdStr);
    fd.append('recordType', 'deal');
    fd.append('noteContent', `Shoot WhatsApp template notification: "${templateId}" sent to ${phone}`);
    const res = await addCrmNote(null, fd);
    if (fd && !res.error) {
      await fetchDetails();
      return true;
    }
    return false;
  };

  const handleNodeClick = (node: any) => {
    // Navigate smoothly to the respective resource detail page based on type
    if (node.status === 'pending') return;
    
    // We can map type to URL paths
    const typeRoutes: Record<string, string> = {
      Lead: '/dashboard/crm/sales-crm/all-leads',
      Quotation: '/dashboard/crm/sales-crm/deals',
      Invoice: '/dashboard/crm/sales/invoices',
      Receipt: '/dashboard/crm/sales/receipts',
    };

    const route = typeRoutes[node.type];
    if (route && dealIdStr) {
      router.push(`${route}/${dealIdStr}`);
    }
  };

  const fmtMoney = (value?: number | null, currency = 'INR'): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value}`;
    }
  };

  const fmtDate = (v?: string | Date | null): string => {
    if (!v) return '—';
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  return (
    <EntityDetailShell
      title={deal.name || 'Untitled deal'}
      eyebrow="DEAL CONTROL TOWER"
      back={{ href: '/dashboard/crm/sales-crm/deals', label: 'Back to Deals' }}
      actions={
        <DealDetailActions
          dealId={dealIdStr}
          stage={deal.stage ?? ''}
          stages={stages}
          contactEmail={contactPrimary.email}
          contactPhone={contactPrimary.phone}
        />
      }
    >
      <div className="space-y-6">
        {/* Dynamic Lineage Node Chart mapping Conversion Pathway */}
        {lineageNodes.length > 0 && (
          <CrmLineageChart nodes={lineageNodes} onNodeClick={handleNodeClick} />
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main profile layout (Overview, breakdown, products) */}
          <div className="lg:col-span-2 space-y-6">
            {/* High-density Deal Overview card */}
            <Card className="p-6 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <h2 className="text-[14px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--st-text)]" /> Deal Details &amp; Assignments
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField label="Deal Owner">
                  <span className="font-medium text-[var(--st-text)] flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                    {deal.ownerId ? `User ${String(deal.ownerId).slice(-6)}` : '—'}
                  </span>
                </DetailField>
                <DetailField label="Target Pipeline">
                  <span className="font-semibold text-[var(--st-text)]">{deal.pipelineId || '—'}</span>
                </DetailField>
                <DetailField label="Client Label">
                  <span className="font-semibold text-[var(--st-text)]">{deal.clientLabel || '—'}</span>
                </DetailField>
                <DetailField label="Lead Source">{deal.leadSource || '—'}</DetailField>
                <DetailField label="Priority Level">
                  <Badge variant={deal.priority === 'High' ? 'danger' : 'neutral'}>
                    {deal.priority || 'Medium'}
                  </Badge>
                </DetailField>
                <DetailField label="Campaign">{deal.campaign || '—'}</DetailField>
                <DetailField label="Next Step Action">{deal.nextStep || '—'}</DetailField>
                <DetailField label="Loss Reason">{deal.lossReason || '—'}</DetailField>
              </div>
            </Card>

            {/* Bulky Financials / Forecasting Cards with Harmonious HSL tailwinds */}
            <Card className="p-6 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <h2 className="text-[14px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--st-status-ok)]" /> Revenue &amp; Forecast breakdown
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Total Amount" value={fmtMoney(amount, dealCurrency)} icon={<DollarSign className="h-4 w-4" />} />
                <Stat label="Probability" value={probabilityPct != null ? `${probabilityPct}%` : '—'} icon={<TrendingUp className="h-4 w-4" />} />
                <Stat label="Weighted Forecast" value={weighted != null ? fmtMoney(weighted, dealCurrency) : '—'} icon={<TrendingUp className="h-4 w-4" />} />
                <Stat label="Expected Close Date" value={fmtDate(deal.closeDate)} icon={<Calendar className="h-4 w-4" />} />
                <Stat label="Deal Age" value={dealAge != null ? `${dealAge} days` : '—'} icon={<Clock className="h-4 w-4" />} />
                <Stat label="Stage Age" value={stageAge != null ? `${stageAge} days` : '—'} icon={<Clock className="h-4 w-4" />} />
              </div>
            </Card>

            {/* Associated Products table */}
            {Array.isArray(deal.products) && deal.products.length > 0 && (
              <Card className="p-6 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <h2 className="text-[14px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-4">
                  Line Items / Products Configured
                </h2>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/15">
                  <table className="w-full text-[12.5px] leading-tight">
                    <thead className="bg-[var(--st-bg-muted)]/50 border-b border-[var(--st-border)] text-[var(--st-text-secondary)]">
                      <tr>
                        <th className="p-3 text-left">Product Name</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deal.products.map((p: any, i: number) => {
                        const total = (p.quantity ?? 0) * (p.price ?? 0);
                        return (
                          <tr key={i} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/20">
                            <td className="p-3 font-medium text-[var(--st-text)]">{p.name}</td>
                            <td className="p-3 text-right font-mono tabular-nums">{p.quantity}</td>
                            <td className="p-3 text-right font-mono tabular-nums">{fmtMoney(p.price, dealCurrency)}</td>
                            <td className="p-3 text-right font-mono font-semibold tabular-nums text-[var(--st-text)]">{fmtMoney(total, dealCurrency)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* 360-Timeline combined view */}
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-[var(--st-text)] px-1">Engagement &amp; System Activity logs</h2>
              <Crm360Timeline
                items={timelineItems}
                onAddComment={handleAddComment}
                onSendWhatsApp={handleSendWhatsApp}
              />
            </div>
          </div>

          {/* Right quick-action sidebar */}
          <div className="space-y-6">
            {/* Progress Stepper tracking stage */}
            <Card className="p-5 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-4">
                Pipeline Stages
              </h3>
              <ol className="space-y-2">
                {stages.map((s) => {
                  const isCurrent = s === deal.stage;
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] transition-colors ${
                        isCurrent
                          ? 'bg-[var(--st-text)]/10 border border-primary/20 font-semibold text-[var(--st-text)] shadow-sm'
                          : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          isCurrent ? 'bg-[var(--st-text)] animate-pulse' : 'bg-[var(--st-border)]'
                        }`}
                        aria-hidden
                      />
                      {s}
                      {isCurrent ? (
                        <span className="ml-auto text-[10px] tracking-wider uppercase font-bold text-[var(--st-text)]">
                          current
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* At a glance controls */}
            <Card className="p-5 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)] mb-3">
                At a glance
              </h3>
              <DealQuickEdits
                dealId={dealIdStr}
                ownerId={deal.ownerId ? String(deal.ownerId) : null}
                stage={deal.stage ?? ''}
                status={dealStatus}
                stages={stages}
              />
              <div className="mt-4 pt-3 border-t border-[var(--st-border)] space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-tertiary)]">Stage age</span>
                  <span className="font-mono text-[var(--st-text)] font-semibold">
                    {stageAge != null ? `${stageAge} days` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-tertiary)]">Created At</span>
                  <span className="font-semibold text-[var(--st-text)]">{fmtDate(deal.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--st-text-tertiary)]">Last Updated</span>
                  <span className="font-semibold text-[var(--st-text)]">{fmtDate(deal.updatedAt)}</span>
                </div>
              </div>
            </Card>

            {/* Related items rail counts */}
            <RelatedRail
              items={[
                {
                  label: 'Associated Client Accounts',
                  count: related.accounts || 0,
                  icon: <Briefcase className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/accounts?dealId=${dealIdStr}`,
                },
                {
                  label: 'Contacts',
                  count: related.contacts || 0,
                  icon: <User className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/contacts?dealId=${dealIdStr}`,
                },
                {
                  label: 'Tasks',
                  count: related.tasks || 0,
                  icon: <ListChecks className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/tasks?dealId=${dealIdStr}`,
                },
                {
                  label: 'Related Invoices',
                  count: related.invoices || 0,
                  icon: <Receipt className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales/invoices?dealId=${dealIdStr}`,
                },
                {
                  label: 'Uploaded Attachments',
                  count: related.attachments || 0,
                  icon: <Paperclip className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/files?entity=deal&entityId=${dealIdStr}`,
                },
              ]}
            />
          </div>
        </div>
      </div>
    </EntityDetailShell>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">
        {label}
      </div>
      <div className="text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)]/20 px-4 py-3 flex items-start justify-between shadow-[var(--zoru-shadow-sm)]">
      <div className="space-y-1">
        <dt className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--st-text-tertiary)]">{label}</dt>
        <dd className="font-mono font-bold text-[15px] tabular-nums text-[var(--st-text)]">{value}</dd>
      </div>
      {icon && <span className="text-[var(--st-text)] opacity-80 mt-0.5">{icon}</span>}
    </div>
  );
}
