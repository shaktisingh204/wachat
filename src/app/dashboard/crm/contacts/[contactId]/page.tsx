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
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useParams,
  useRouter } from 'next/navigation';
import {
  getCrmContactById,
  getCrmContactRelatedCounts,
  getCrmEntityTimeline,
  getCrmContactLineage,
  addCrmNote,
  } from '@/app/actions/crm.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import type { CrmContact,
  WithId,
  CrmAccount,
  CrmDeal } from '@/lib/definitions';
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
  } from 'lucide-react';
import Link from 'next/link';
import { RelatedRail } from '@/components/crm/RelatedRail';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Crm360Timeline } from '@/components/crm/crm-360-timeline';
import { CrmLineageChart } from '@/components/crm/crm-lineage-chart';

function ContactDetailPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function CrmContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.contactId as string;
  const [contact, setContact] = useState<WithId<CrmContact> | null>(null);
  const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
  const [deals, setDeals] = useState<WithId<CrmDeal>[]>([]);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [lineageNodes, setLineageNodes] = useState<any[]>([]);
  const [relatedCounts, setRelatedCounts] = useState<{
    deals: number;
    tasks: number;
    notes: number;
    tickets: number;
    invoices: number;
    attachments: number;
  }>({ deals: 0, tasks: 0, notes: 0, tickets: 0, invoices: 0, attachments: 0 });
  const [isLoading, startTransition] = useTransition();

  const fetchAdditionalDetails = async (fetchedContact: WithId<CrmContact>) => {
    try {
      const timelineRes = await getCrmEntityTimeline('contact', contactId);
      if (timelineRes.success) {
        setTimelineItems(timelineRes.items);
      }
      const lineageRes = await getCrmContactLineage(contactId);
      if (lineageRes.success) {
        setLineageNodes(lineageRes.nodes);
      }
    } catch (e) {
      console.error('[CrmContactDetailPage] timeline/lineage load failed:', e);
    }
  };

  useEffect(() => {
    if (contactId) {
      startTransition(async () => {
        const fetchedContact = await getCrmContactById(contactId);
        setContact(fetchedContact);
        if (fetchedContact?.accountId) {
          const fetchedAccount = await getCrmAccountById(fetchedContact.accountId.toString());
          setAccount(fetchedAccount);
        }
        if (fetchedContact) {
          const allDeals = await getCrmDeals();
          setDeals(
            (allDeals as any).deals?.filter((d: any) =>
              d.contactIds?.some(
                (id: any) => id.toString() === fetchedContact._id.toString(),
              ),
            ),
          );
          await fetchAdditionalDetails(fetchedContact);
        }
        try {
          const counts = await getCrmContactRelatedCounts(contactId);
          setRelatedCounts(counts);
        } catch {
          /* leave zeros */
        }
      });
    }
  }, [contactId]);

  const handleWhatsAppMessage = () => {
    const waId = contact?.phone?.replace(/\D/g, '');
    if (waId) {
      router.push(`/wachat/chat?waId=${waId}`);
    }
  };

  const handleAddComment = async (body: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', contactId);
    fd.append('recordType', 'contact');
    fd.append('noteContent', body);
    const res = await addCrmNote(null, fd);
    if (res.error) {
      return false;
    }
    const refreshed = await getCrmEntityTimeline('contact', contactId);
    if (refreshed.success) {
      setTimelineItems(refreshed.items);
    }
    return true;
  };

  const handleSendWhatsApp = async (templateId: string, phone: string): Promise<boolean> => {
    const fd = new FormData();
    fd.append('recordId', contactId);
    fd.append('recordType', 'contact');
    fd.append('noteContent', `Shoot WhatsApp template notification: "${templateId}" sent to ${phone}`);
    const res = await addCrmNote(null, fd);
    if (res.error) {
      return false;
    }
    const refreshed = await getCrmEntityTimeline('contact', contactId);
    if (refreshed.success) {
      setTimelineItems(refreshed.items);
    }
    return true;
  };

  if (isLoading || !contact) {
    return <ContactDetailPageSkeleton />;
  }

  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
  };

  const dealStageVariant = (stage: string | null | undefined): 'success' | 'danger' | 'ghost' => {
    const s = (stage ?? '').toLowerCase();
    if (s === 'won') return 'success';
    if (s === 'lost') return 'danger';
    return 'ghost';
  };

  return (
    <EntityDetailShell
      eyebrow="CONTACT CONTROL CENTER"
      title={contact.name}
      back={{ href: '/dashboard/crm/contacts', label: 'Contacts' }}
      actions={
        <div className="flex gap-2">
          <Link href={`/dashboard/crm/contacts/${contactId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} />
              Edit
            </Button>
          </Link>
        </div>
      }
    >
      <div className="flex w-full flex-col gap-6">
        
        {/* Full-width Lineage Flow Tracker */}
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
                <Avatar className="mb-3 h-24 w-24 border border-zoru-line">
                  <ZoruAvatarImage src={contact.avatarUrl || ''} data-ai-hint="person avatar" />
                  <ZoruAvatarFallback className="bg-accent text-[26px] text-accent-foreground">
                    {contact.name.charAt(0)}
                  </ZoruAvatarFallback>
                </Avatar>
                <h2 className="text-[16px] font-semibold text-zoru-ink">{contact.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  {contact.jobTitle || 'N/A'}
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px]"
                  onClick={handleWhatsAppMessage}
                  disabled={!contact.phone}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px]"
                  disabled={!contact.phone}
                  onClick={() => {
                    if (contact.phone) window.location.href = `tel:${contact.phone}`;
                  }}
                >
                  <Phone className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} />
                  Call
                </Button>
              </div>

              <Separator className="my-4 bg-zoru-line" />

              <div className="space-y-2.5 text-[13px] text-zoru-ink">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-primary hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                  <span>{contact.phone || 'N/A'}</span>
                </div>
                {account && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                    <Link
                      href={`/dashboard/crm/accounts/${account._id.toString()}`}
                      className="text-primary hover:underline"
                    >
                      {account.name}
                    </Link>
                  </div>
                )}
              </div>

              <Separator className="my-4 bg-zoru-line" />

              <div className="space-y-3">
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted font-bold">
                    Lead Score
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant={leadScoreVariant(contact.leadScore || 0)}>
                      {contact.leadScore || 0}
                    </Badge>
                    <span className="text-[12.5px] text-zoru-ink-muted">Hot Lead Priority</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted font-bold">
                    Lifecycle Status
                  </p>
                  <div className="mt-1.5">
                    <Badge variant="danger">{contact.status}</Badge>
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
                  href: `/dashboard/crm/sales-crm/deals?contactId=${contactId}`,
                },
                {
                  label: 'Tasks',
                  count: relatedCounts.tasks,
                  icon: <ListChecks className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/tasks?contactId=${contactId}`,
                },
                {
                  label: 'Notes',
                  count: relatedCounts.notes,
                  icon: <StickyNote className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/contacts/${contactId}`,
                },
                {
                  label: 'Tickets',
                  count: relatedCounts.tickets,
                  icon: <LifeBuoy className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/tickets?contactId=${contactId}`,
                },
                {
                  label: 'Invoices',
                  count: relatedCounts.invoices,
                  icon: <Receipt className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/sales/invoices?contactId=${contactId}`,
                },
                {
                  label: 'Attachments',
                  count: relatedCounts.attachments,
                  icon: <Paperclip className="h-3.5 w-3.5" />,
                  href: `/dashboard/crm/files?entity=contact&entityId=${contactId}`,
                },
              ]}
            />
          </div>

          {/* Main Area: Combined Timeline + Associated Deals */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* 360 Timeline (Post Comment & Audit Logs) */}
            <Crm360Timeline
              items={timelineItems}
              onAddComment={handleAddComment}
              onSendWhatsApp={handleSendWhatsApp}
            />

            {/* Associated Deals Table */}
            <Card className="p-6 border border-zoru-line bg-zoru-surface">
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-zoru-ink">Associated Opportunities</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  Pipeline deals associated with this client record.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zoru-line bg-zoru-surface-2/10">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted">Deal Name</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                      <ZoruTableHead className="text-right text-zoru-ink-muted">Pipeline Value</ZoruTableHead>
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
                          <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                            {deal.name}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <Badge variant={dealStageVariant(deal.stage)}>{deal.stage ?? '—'}</Badge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-medium text-zoru-ink">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency || 'USD',
                            }).format(deal.value)}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    ) : (
                      <ZoruTableRow className="border-zoru-line">
                        <ZoruTableCell
                          colSpan={3}
                          className="h-24 text-center text-[13px] text-zoru-ink-muted"
                        >
                          No active deals currently associated with this client.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    )}
                  </ZoruTableBody>
                </Table>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </EntityDetailShell>
  );
}
