'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Button,
  Card,
  Separator,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCrmLeadById,
  getCrmLeadRelatedCounts,
  changeCrmLeadStatus,
  updateCrmLeadStage,
} from '@/app/actions/crm-leads.actions';
import {
  getCrmEntityTimeline,
  getCrmLeadLineage,
  addCrmNote,
} from '@/app/actions/crm.actions';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmDeal } from '@/lib/definitions';
import {
  Briefcase,
  Mail,
  Phone,
  MessageSquare,
  Handshake,
  ListChecks,
  StickyNote,
  LifeBuoy,
  Receipt,
  Paperclip,
  Pencil,
  FileText,
  Calendar,
  Layers,
  Sparklines,
  Activity,
  ArrowLeft,
  MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Crm360Timeline } from '@/components/crm/crm-360-timeline';
import { CrmLineageChart } from '@/components/crm/crm-lineage-chart';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { CustomFieldDisplay } from '@/components/crm/custom-field-input';
import { fmtDate, fmtINR } from '@/lib/utils';

import Loading from './loading';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[13px] text-zoru-ink font-medium">{children}</div>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<any | null>(null);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [lineageNodes, setLineageNodes] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<WsCustomField[]>([]);
  const [relatedCounts, setRelatedCounts] = useState<{
    deals: number;
    tasks: number;
    tickets: number;
    quotations: number;
  }>({ deals: 0, tasks: 0, tickets: 0, quotations: 0 });

  const [isLoading, startTransition] = useTransition();

  const fetchTimelineAndLineage = async () => {
    try {
      const timelineRes = await getCrmEntityTimeline('lead', id);
      if (timelineRes.success) {
        setTimelineItems(timelineRes.items);
      }
      const lineageRes = await getCrmLeadLineage(id);
      if (lineageRes.success) {
        setLineageNodes(lineageRes.nodes);
      }
    } catch (e) {
      console.error('[LeadDetailPage] timeline/lineage load failed:', e);
    }
  };

  useEffect(() => {
    if (id) {
      startTransition(async () => {
        try {
          const fetchedLead = await getCrmLeadById(id);
          setLead(fetchedLead);

          const cf = await getCustomFieldsFor('lead').catch(() => []);
          setCustomFields(cf);

          if (fetchedLead) {
            const allDeals = await getCrmDeals();
            setDeals(
              (allDeals as any).deals?.filter((d: any) =>
                d.lineage?.some((l: any) => l.kind === 'lead' && l.id === id)
              ) || [],
            );
            await fetchTimelineAndLineage();
          }

          const counts = await getCrmLeadRelatedCounts(id);
          setRelatedCounts(counts);
        } catch (e) {
          console.error('[LeadDetailPage] error hydrating details:', e);
        }
      });
    }
  }, [id]);

  const handleWhatsAppMessage = () => {
    const waId = lead?.phone?.replace(/\D/g, '');
    if (waId) {
      router.push(`/wachat/chat?waId=${waId}`);
    }
  };

  const handleAddComment = async (body: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', id);
    fd.append('recordType', 'lead');
    fd.append('noteContent', body);
    const res = await addCrmNote(null, fd);
    if (res.error) {
      return false;
    }
    const refreshed = await getCrmEntityTimeline('lead', id);
    if (refreshed.success) {
      setTimelineItems(refreshed.items);
    }
    return true;
  };

  const handleSendWhatsApp = async (templateId: string, phone: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', id);
    fd.append('recordType', 'lead');
    fd.append('noteContent', `Shoot WhatsApp template notification: "${templateId}" sent to ${phone}`);
    const res = await addCrmNote(null, fd);
    if (res.error) {
      return false;
    }
    const refreshed = await getCrmEntityTimeline('lead', id);
    if (refreshed.success) {
      setTimelineItems(refreshed.items);
    }
    return true;
  };

  if (isLoading || !lead) {
    return <Loading />;
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.email || 'Lead';
  const cfValues = (lead.customFields ?? {}) as Record<string, unknown>;

  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
  };

  const fmtMoney = (value?: number, currency?: string): string => {
    return fmtINR(value, currency);
  };

  const getStatusTone = (status: string | null | undefined): 'neutral' | 'blue' | 'green' | 'amber' | 'red' => {
    const s = String(status || '').toLowerCase();
    if (s.includes('new') || s.includes('unqualified')) return 'neutral';
    if (s.includes('contacted') || s.includes('working')) return 'blue';
    if (s.includes('qualified') || s.includes('won') || s.includes('converted')) return 'green';
    if (s.includes('nurturing') || s.includes('cold')) return 'amber';
    return 'red';
  };

  return (
    <EntityDetailShell
      eyebrow="LEAD CONTROL TOWER"
      title={fullName}
      back={{ href: '/dashboard/crm/leads', label: 'Leads' }}
      status={{ label: lead.status?.name || lead.status || 'New', tone: getStatusTone(lead.status?.name || lead.status) }}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/crm/leads/${id}/edit`}>
            <Button variant="outline" size="sm" className="h-8 px-3 text-[12px]">
              <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} /> Edit
            </Button>
          </Link>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-6">
        {/* Full-width Lineage Chart */}
        {lineageNodes && lineageNodes.length > 0 && (
          <CrmLineageChart
            nodes={lineageNodes}
            onNodeClick={(node) => {
              console.log('Selected lineage node:', node);
            }}
          />
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Profile Sidebar */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="p-6 border border-zoru-line bg-zoru-surface">
              <div className="flex flex-col items-center text-center">
                <Avatar className="mb-3 h-20 w-20 border border-zoru-line">
                  <ZoruAvatarFallback className="bg-accent text-[24px] text-accent-foreground font-semibold">
                    {fullName.charAt(0)}
                  </ZoruAvatarFallback>
                </Avatar>
                <h2 className="text-[16px] font-bold text-zoru-ink leading-tight">{fullName}</h2>
                <p className="mt-1 text-[12px] text-zoru-ink-muted font-medium">
                  {lead.title || lead.company || 'Lead Scaffolding'}
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px] h-8.5"
                  onClick={handleWhatsAppMessage}
                  disabled={!lead.phone}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px] h-8.5"
                  disabled={!lead.phone}
                  onClick={() => {
                    if (lead.phone) window.location.href = `tel:${lead.phone}`;
                  }}
                >
                  <Phone className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
                  Call
                </Button>
              </div>

              <Separator className="my-4 bg-zoru-line" />

              <div className="space-y-3 text-[13px] text-zoru-ink font-medium">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-zoru-ink-muted" strokeWidth={2} />
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate">
                    {lead.email || 'No email registered'}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-zoru-ink-muted" strokeWidth={2} />
                  <span>{lead.phone || 'No phone registered'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-zoru-ink-muted" strokeWidth={2} />
                  <span>{lead.company || 'No company info'}</span>
                </div>
              </div>

              <Separator className="my-4 bg-zoru-line" />

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zoru-ink-muted font-extrabold">
                    Lead Priority / Score
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant={leadScoreVariant(lead.leadScore || 0)}>
                      {lead.leadScore || 0}
                    </Badge>
                    <span className="text-[12px] text-zoru-ink-muted font-medium">Hot Lead Priority</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zoru-ink-muted font-extrabold">
                    Lifecycle Status
                  </p>
                  <div className="mt-1.5">
                    <Badge variant="ghost" className="bg-zoru-surface-2 border border-zoru-line text-[11px] h-5.5 font-semibold text-zoru-ink">
                      {lead.status?.name || lead.status || 'New'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            <RelatedRail
              items={[
                {
                  label: 'Deals',
                  count: relatedCounts.deals,
                  icon: <Handshake className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales-crm/deals?leadId=${id}`,
                },
                {
                  label: 'Tasks',
                  count: relatedCounts.tasks,
                  icon: <ListChecks className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/tasks?leadId=${id}`,
                },
                {
                  label: 'Tickets',
                  count: relatedCounts.tickets,
                  icon: <LifeBuoy className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/tickets?leadId=${id}`,
                },
                {
                  label: 'Quotations',
                  count: relatedCounts.quotations,
                  icon: <FileText className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales/quotations?leadId=${id}`,
                },
              ]}
            />
          </div>

          {/* Main Content Area */}
          <div className="space-y-6 lg:col-span-2">
            {/* Identity & Basic Profile card */}
            <Card className="p-6 border border-zoru-line bg-zoru-surface">
              <h3 className="mb-4 text-[12px] font-extrabold uppercase tracking-widest text-zoru-ink-muted flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" /> Profile Identity & CRM Attributes
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name">{fullName}</Field>
                <Field label="Job title">{lead.title || '—'}</Field>
                <Field label="Email">{lead.email || '—'}</Field>
                <Field label="Phone">{lead.phone || '—'}</Field>
                <Field label="Company">{lead.company || '—'}</Field>
                <Field label="Industry">{lead.industry || '—'}</Field>
              </div>

              <h3 className="mb-4 mt-8 text-[12px] font-extrabold uppercase tracking-widest text-zoru-ink-muted flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" /> Attribution & Workflows
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Lead Source">{lead.attribution?.source || lead.source || '—'}</Field>
                <Field label="Sub-source">{lead.subSource || '—'}</Field>
                <Field label="Status">
                  {lead.status?.name || lead.status ? <Badge variant="outline">{lead.status?.name || lead.status}</Badge> : '—'}
                </Field>
                <Field label="Lead score">{lead.leadScore ?? '—'}</Field>
                <Field label="Owner">
                  {lead.ownerId ? (
                    <EntityPickerChip entity="user" id={lead.ownerId} />
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Assigned to">
                  {lead.assignment?.assignedTo || lead.assignedTo ? (
                    <EntityPickerChip entity="user" id={lead.assignment?.assignedTo || lead.assignedTo} />
                  ) : (
                    '—'
                  )}
                </Field>
              </div>
            </Card>

            {/* Financial Details */}
            <Card className="p-6 border border-zoru-line bg-zoru-surface">
              <h3 className="mb-4 text-[12px] font-extrabold uppercase tracking-widest text-zoru-ink-muted flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-primary" /> Estimated Values & Forecaster
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Estimated value">{fmtMoney(lead.estimatedValue || lead.value, lead.currency)}</Field>
                <Field label="Currency">{lead.currency || '—'}</Field>
                <Field label="Probability">
                  {typeof lead.probabilityPct === 'number' ? `${lead.probabilityPct}%` : '—'}
                </Field>
                <Field label="Expected close">{fmtDate(lead.expectedClose)}</Field>
              </div>
            </Card>

            {/* Custom fields if present */}
            {customFields.length > 0 && (
              <Card className="p-6 border border-zoru-line bg-zoru-surface">
                <h3 className="mb-4 text-[12px] font-extrabold uppercase tracking-widest text-zoru-ink-muted flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" /> Tenant custom fields
                </h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  {customFields.map((f) => (
                    <Field key={String(f._id ?? f.name)} label={f.label || f.name}>
                      <CustomFieldDisplay
                        field={f}
                        value={cfValues[f.name] as Parameters<typeof CustomFieldDisplay>[0]['value']}
                      />
                    </Field>
                  ))}
                </div>
              </Card>
            )}

            {/* 360 Timeline */}
            <Crm360Timeline
              items={timelineItems}
              onAddComment={handleAddComment}
              onSendWhatsApp={handleSendWhatsApp}
            />

            {/* Opportunities (Deals) related */}
            <Card className="p-6 border border-zoru-line bg-zoru-surface">
              <div className="mb-4">
                <h2 className="text-[16px] font-bold text-zoru-ink">Associated Opportunities</h2>
                <p className="mt-1 text-[12px] text-zoru-ink-muted font-medium">
                  Pipeline deals associated with this lead.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zoru-line bg-zoru-surface-2/10">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted font-semibold text-[12px]">Deal Name</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted font-semibold text-[12px]">Stage</ZoruTableHead>
                      <ZoruTableHead className="text-right text-zoru-ink-muted font-semibold text-[12px]">Pipeline Value</ZoruTableHead>
                      <ZoruTableHead className="w-[50px]"></ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {deals.length > 0 ? (
                      deals.map((deal) => (
                        <ZoruTableRow
                          key={deal._id.toString()}
                          onClick={() =>
                            router.push(`/dashboard/crm/deals/${deal._id.toString()}`)
                          }
                          className="cursor-pointer border-zoru-line hover:bg-zoru-surface-2/30"
                        >
                          <ZoruTableCell className="text-[13px] font-semibold text-zoru-ink">
                            {deal.name}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <Badge variant={(deal.stage || '').toLowerCase() === 'won' ? 'success' : (deal.stage || '').toLowerCase() === 'lost' ? 'danger' : 'info'}>
                              {deal.stage ?? '—'}
                            </Badge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-semibold text-zoru-ink">
                            {fmtMoney(deal.value, deal.currency)}
                          </ZoruTableCell>
                          <ZoruTableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/crm/deals/${deal._id.toString()}/edit`)}>
                                  Edit Deal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/crm/deals/${deal._id.toString()}`)}>
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    ) : (
                      <ZoruTableRow className="border-zoru-line">
                        <ZoruTableCell
                          colSpan={4}
                          className="h-24 text-center text-[12.5px] text-zoru-ink-muted font-medium"
                        >
                          No active deals currently associated with this lead.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    )}
                  </ZoruTableBody>
                </Table>
              </div>
            </Card>

            <div className="text-[11px] text-zoru-ink-subtle font-mono mt-4">
              Created {fmtDate(lead.createdAt || lead.audit?.createdAt)} · Updated{' '}
              {fmtDate(lead.updatedAt || lead.audit?.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </EntityDetailShell>
  );
}
