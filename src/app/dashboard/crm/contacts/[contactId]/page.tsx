'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCrmContactById } from '@/app/actions/crm.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import type { CrmContact, WithId, CrmAccount, CrmDeal } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Briefcase,
  Mail,
  Phone,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

function ContactDetailPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Skeleton className="h-64 w-full rounded-clay-lg" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-48 w-full rounded-clay-lg" />
          <Skeleton className="h-64 w-full rounded-clay-lg" />
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
      });
    }
  }, [contactId]);

  const handleWhatsAppMessage = () => {
    const waId = contact?.phone?.replace(/\D/g, '');
    if (waId) {
      router.push(`/dashboard/chat?waId=${waId}`);
    }
  };

  if (isLoading || !contact) {
    return <ContactDetailPageSkeleton />;
  }

  const leadScoreTone = (score: number): 'green' | 'amber' | 'red' => {
    if (score > 75) return 'green';
    if (score > 50) return 'amber';
    return 'red';
  };

  const dealStageTone = (stage: string): 'green' | 'red' | 'rose-soft' => {
    const s = stage.toLowerCase();
    if (s === 'won') return 'green';
    if (s === 'lost') return 'red';
    return 'rose-soft';
  };

  return (
    <>
      <ComposeEmailDialog
        isOpen={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        initialTo={contact.email}
        initialSubject={`Following up`}
      />
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href="/dashboard/crm/contacts"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-clay-ink-muted hover:text-clay-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to All Contacts
          </Link>
        </div>

        <CrmPageHeader
          title={contact.name}
          subtitle={contact.jobTitle || 'Contact details and activity'}
          icon={Users}
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <ClayCard>
              <div className="flex flex-col items-center text-center">
                <Avatar className="mb-3 h-24 w-24 border border-clay-border">
                  <AvatarImage src={contact.avatarUrl || ''} data-ai-hint="person avatar" />
                  <AvatarFallback className="bg-clay-rose-soft text-[26px] text-clay-rose-ink">
                    {contact.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-[16px] font-semibold text-clay-ink">{contact.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
                  {contact.jobTitle || 'N/A'}
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <ClayButton
                  variant="pill"
                  size="sm"
                  className="flex-1"
                  leading={<Mail className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  onClick={() => setIsComposeOpen(true)}
                >
                  Email
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="sm"
                  className="flex-1"
                  leading={<MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  onClick={handleWhatsAppMessage}
                  disabled={!contact.phone}
                >
                  WhatsApp
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="sm"
                  className="flex-1"
                  leading={<Phone className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  disabled={!contact.phone}
                  onClick={() => {
                    if (contact.phone) window.location.href = `tel:${contact.phone}`;
                  }}
                >
                  Call
                </ClayButton>
              </div>

              <Separator className="my-4 bg-clay-border" />

              <div className="space-y-2.5 text-[13px] text-clay-ink">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-clay-rose hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                  <span>{contact.phone || 'N/A'}</span>
                </div>
                {account && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                    <Link
                      href={`/dashboard/crm/accounts/${account._id.toString()}`}
                      className="text-clay-rose hover:underline"
                    >
                      {account.name}
                    </Link>
                  </div>
                )}
              </div>

              <Separator className="my-4 bg-clay-border" />

              <div className="space-y-3">
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                    Lead Score
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ClayBadge tone={leadScoreTone(contact.leadScore || 0)} dot>
                      {contact.leadScore || 0}
                    </ClayBadge>
                    <span className="text-[12.5px] text-clay-ink-muted">Hot Lead</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                    Status
                  </p>
                  <div className="mt-1.5">
                    <ClayBadge tone="rose-soft">{contact.status}</ClayBadge>
                  </div>
                </div>
              </div>
            </ClayCard>

            <CrmNotes
              recordId={contact._id.toString()}
              recordType="contact"
              notes={contact.notes || []}
            />
          </div>

          <div className="lg:col-span-2">
            <ClayCard>
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-clay-ink">Associated Deals</h2>
                <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
                  Deals linked to this contact.
                </p>
              </div>
              <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-clay-border hover:bg-transparent">
                      <TableHead className="text-clay-ink-muted">Deal Name</TableHead>
                      <TableHead className="text-clay-ink-muted">Stage</TableHead>
                      <TableHead className="text-right text-clay-ink-muted">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.length > 0 ? (
                      deals.map((deal) => (
                        <TableRow
                          key={deal._id.toString()}
                          onClick={() =>
                            router.push(`/dashboard/crm/deals/${deal._id.toString()}`)
                          }
                          className="cursor-pointer border-clay-border"
                        >
                          <TableCell className="text-[13px] font-medium text-clay-ink">
                            {deal.name}
                          </TableCell>
                          <TableCell>
                            <ClayBadge tone={dealStageTone(deal.stage)}>{deal.stage}</ClayBadge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-clay-ink">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency,
                            }).format(deal.value)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-clay-border">
                        <TableCell
                          colSpan={3}
                          className="h-24 text-center text-[13px] text-clay-ink-muted"
                        >
                          No deals associated with this contact.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ClayCard>
          </div>
        </div>
      </div>
    </>
  );
}
