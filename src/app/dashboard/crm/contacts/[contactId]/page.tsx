'use client';

import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, Separator, Skeleton, Table, TBody, Td, Th, THead, Tr, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input } from '@/components/sabcrm/20ui/compat';
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
  updateCrmContact,
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
  Linkedin,
  Twitter,
  X,
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

  const saveContactUpdates = async (updates: Partial<CrmContact>) => {
    if (!contact) return;
    
    // optimistic update
    const previousContact = { ...contact };
    const updatedContact = { ...contact, ...updates };
    setContact(updatedContact as WithId<CrmContact>);

    const formData = new FormData();
    formData.append('contactId', contact._id.toString());
    formData.append('name', updatedContact.name);
    formData.append('email', updatedContact.email);
    if (updatedContact.phone) formData.append('phone', updatedContact.phone);
    if (updatedContact.company) formData.append('company', updatedContact.company);
    if (updatedContact.jobTitle) formData.append('jobTitle', updatedContact.jobTitle);
    formData.append('status', updatedContact.status);
    if (updatedContact.leadScore != null) formData.append('leadScore', updatedContact.leadScore.toString());
    if (updatedContact.linkedinUrl) formData.append('linkedinUrl', updatedContact.linkedinUrl);
    if (updatedContact.twitterHandle) formData.append('twitterHandle', updatedContact.twitterHandle);
    if (updatedContact.lifecycleStage) formData.append('lifecycleStage', updatedContact.lifecycleStage);
    if (updatedContact.source) formData.append('source', updatedContact.source);
    if (updatedContact.owner) formData.append('owner', updatedContact.owner);
    const tagsToSave = updatedContact.tags ? updatedContact.tags.join(',') : '';
    formData.append('tags', tagsToSave);
    if (updatedContact.dateOfBirth) formData.append('dateOfBirth', new Date(updatedContact.dateOfBirth).toISOString());
    if (updatedContact.timezone) formData.append('timezone', updatedContact.timezone);
    if (updatedContact.accountId) formData.append('accountId', updatedContact.accountId.toString());

    const res = await updateCrmContact({}, formData);
    
    if (res.error) {
      console.error('Failed to update contact:', res.error);
      setContact(previousContact); // revert
    }
  };

  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (!value) return;
      if (contact?.tags?.includes(value)) return;
      
      const newTags = [...(contact?.tags || []), value];
      e.currentTarget.value = '';
      await saveContactUpdates({ tags: newTags });
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = contact?.tags?.filter(t => t !== tagToRemove) || [];
    await saveContactUpdates({ tags: newTags });
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
            <Card className="p-6 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <div className="flex flex-col items-center text-center">
                <Avatar className="mb-3 h-24 w-24 border border-[var(--st-border)]">
                  <AvatarImage src={contact.avatarUrl || ''} data-ai-hint="person avatar" />
                  <AvatarFallback className="bg-[var(--st-bg-muted)] text-[26px] text-[var(--st-text)]">
                    {contact.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-[16px] font-semibold text-[var(--st-text)]">{contact.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
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

              <Separator className="my-4 bg-[var(--st-border)]" />

              <div className="space-y-2.5 text-[13px] text-[var(--st-text)]">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-[var(--st-text)] hover:underline"
                  >
                    {contact.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                  <span>{contact.phone || 'N/A'}</span>
                </div>
                {account && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                    <Link
                      href={`/dashboard/crm/accounts/${account._id.toString()}`}
                      className="text-[var(--st-text)] hover:underline"
                    >
                      {account.name}
                    </Link>
                  </div>
                )}
                {(contact.linkedinUrl || contact.twitterHandle) && (
                  <>
                    <Separator className="my-4 bg-[var(--st-border)]" />
                    {contact.linkedinUrl && (
                      <div className="flex items-center gap-3">
                        <Linkedin className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-[var(--st-text)] hover:underline truncate">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {contact.twitterHandle && (
                      <div className="flex items-center gap-3">
                        <Twitter className="h-4 w-4 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
                        <a href={`https://twitter.com/${contact.twitterHandle.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-[var(--st-text)] hover:underline truncate">
                          {contact.twitterHandle}
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator className="my-4 bg-[var(--st-border)]" />

              <div className="space-y-3">
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)] font-bold">
                    Lead Score
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant={leadScoreVariant(contact.leadScore || 0)}>
                      {contact.leadScore || 0}
                    </Badge>
                    <span className="text-[12.5px] text-[var(--st-text-secondary)]">Hot Lead Priority</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)] font-bold">
                    Lifecycle Status
                  </p>
                  <div className="mt-1.5">
                    <Select value={contact.status} onValueChange={(val) => saveContactUpdates({ status: val as any })}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_lead">New Lead</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="unqualified">Unqualified</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="imported">Imported</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)] font-bold mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {contact.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1 px-1.5 py-0">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-[var(--st-text)]" 
                          onClick={() => handleRemoveTag(tag)} 
                        />
                      </Badge>
                    ))}
                  </div>
                  <Input 
                    placeholder="Add a tag and press Enter..." 
                    className="h-7 text-xs bg-transparent border-[var(--st-border)]"
                    onKeyDown={handleAddTag}
                  />
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
                  href: `/dashboard/sabdesk?contactId=${contactId}`,
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
            <Card className="p-6 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Associated Opportunities</h2>
                <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                  Pipeline deals associated with this client record.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/10">
                <Table>
                  <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                      <Th className="text-[var(--st-text-secondary)]">Deal Name</Th>
                      <Th className="text-[var(--st-text-secondary)]">Stage</Th>
                      <Th className="text-right text-[var(--st-text-secondary)]">Pipeline Value</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {deals.length > 0 ? (
                      deals.map((deal) => (
                        <Tr
                          key={deal._id.toString()}
                          onClick={() =>
                            router.push(`/dashboard/crm/deals/${deal._id.toString()}`)
                          }
                          className="cursor-pointer border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/30"
                        >
                          <Td className="text-[13px] font-medium text-[var(--st-text)]">
                            {deal.name}
                          </Td>
                          <Td>
                            <Badge variant={dealStageVariant(deal.stage)}>{deal.stage ?? '—'}</Badge>
                          </Td>
                          <Td className="text-right font-medium text-[var(--st-text)]">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: deal.currency || 'USD',
                            }).format(deal.value)}
                          </Td>
                        </Tr>
                      ))
                    ) : (
                      <Tr className="border-[var(--st-border)]">
                        <Td
                          colSpan={3}
                          className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                        >
                          No active deals currently associated with this client.
                        </Td>
                      </Tr>
                    )}
                  </TBody>
                </Table>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </EntityDetailShell>
  );
}
