'use client';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSeparator,
  ZoruSkeleton,
  ZoruTable,
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
  } from 'lucide-react';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';
import { RelatedRail } from '@/components/crm/RelatedRail';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

function ContactDetailPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruSkeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <ZoruSkeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <ZoruSkeleton className="h-48 w-full rounded-xl" />
          <ZoruSkeleton className="h-64 w-full rounded-xl" />
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
  const [relatedCounts, setRelatedCounts] = useState<{
    deals: number;
    tasks: number;
    notes: number;
    tickets: number;
    invoices: number;
    attachments: number;
  }>({ deals: 0, tasks: 0, notes: 0, tickets: 0, invoices: 0, attachments: 0 });
  const [isLoading, startTransition] = useTransition();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

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

  if (isLoading || !contact) {
    return <ContactDetailPageSkeleton />;
  }

  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
  };

  const dealStageVariant = (stage: string): 'success' | 'danger' | 'ghost' => {
    const s = stage.toLowerCase();
    if (s === 'won') return 'success';
    if (s === 'lost') return 'danger';
    return 'ghost';
  };

  return (
    <>
      <ComposeEmailDialog
        isOpen={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        initialTo={contact.email}
        initialSubject={`Following up`}
      />
      <EntityDetailShell
        eyebrow="CONTACT"
        title={contact.name}
        back={{ href: '/dashboard/crm/contacts', label: 'Contacts' }}
      >
      <div className="flex w-full flex-col gap-6">

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <ZoruCard className="p-6">
              <div className="flex flex-col items-center text-center">
                <ZoruAvatar className="mb-3 h-24 w-24 border border-zoru-line">
                  <ZoruAvatarImage src={contact.avatarUrl || ''} data-ai-hint="person avatar" />
                  <ZoruAvatarFallback className="bg-accent text-[26px] text-accent-foreground">
                    {contact.name.charAt(0)}
                  </ZoruAvatarFallback>
                </ZoruAvatar>
                <h2 className="text-[16px] font-semibold text-zoru-ink">{contact.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  {contact.jobTitle || 'N/A'}
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsComposeOpen(true)}
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Email
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleWhatsAppMessage}
                  disabled={!contact.phone}
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                  WhatsApp
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!contact.phone}
                  onClick={() => {
                    if (contact.phone) window.location.href = `tel:${contact.phone}`;
                  }}
                >
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Call
                </ZoruButton>
              </div>

              <ZoruSeparator className="my-4 bg-zoru-line" />

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

              <ZoruSeparator className="my-4 bg-zoru-line" />

              <div className="space-y-3">
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                    Lead Score
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ZoruBadge variant={leadScoreVariant(contact.leadScore || 0)}>
                      {contact.leadScore || 0}
                    </ZoruBadge>
                    <span className="text-[12.5px] text-zoru-ink-muted">Hot Lead</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                    Status
                  </p>
                  <div className="mt-1.5">
                    <ZoruBadge variant="danger">{contact.status}</ZoruBadge>
                  </div>
                </div>
              </div>
            </ZoruCard>

            <CrmNotes
              recordId={contact._id.toString()}
              recordType="contact"
              notes={contact.notes || []}
            />

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

          <div className="lg:col-span-2">
            <ZoruCard className="p-6">
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-zoru-ink">Associated Deals</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  Deals linked to this contact.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted">Deal Name</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                      <ZoruTableHead className="text-right text-zoru-ink-muted">Value</ZoruTableHead>
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
                          className="cursor-pointer border-zoru-line"
                        >
                          <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                            {deal.name}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={dealStageVariant(deal.stage)}>{deal.stage}</ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right font-medium text-zoru-ink">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency,
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
                          No deals associated with this contact.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    )}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            </ZoruCard>
          </div>
        </div>
      </div>
      </EntityDetailShell>
    </>
  );
}
