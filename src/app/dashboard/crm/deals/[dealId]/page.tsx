'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { getCrmDealById } from '@/app/actions/crm-deals.actions';
import { getCrmContactById } from '@/app/actions/crm.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import type { CrmDeal, CrmContact, CrmAccount, WithId, CrmTask } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building,
  DollarSign,
  Users,
  Calendar,
  Handshake,
  ReceiptText,
  LoaderCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { convertDealToInvoice } from '@/app/actions/worksuite/conversions.actions';
import { ClayButton } from '@/components/clay';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { CreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';

import { ClayCard, ClayBadge } from '@/components/clay';
import { useRouter } from 'next/navigation';
import { CrmPageHeader } from '../../_components/crm-page-header';

function DealDetailPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Skeleton className="h-48 w-full rounded-clay-lg" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-96 w-full rounded-clay-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CrmDealDetailPage() {
  const params = useParams();
  const dealId = params.dealId as string;

  const [deal, setDeal] = useState<WithId<CrmDeal> | null>(null);
  const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
  const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
  const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const invoiceInFlightRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();

  const fetchData = () => {
    if (dealId) {
      startTransition(async () => {
        const fetchedDeal = await getCrmDealById(dealId);
        setDeal(fetchedDeal);

        if (fetchedDeal) {
          const [fetchedAccount, fetchedContacts, fetchedTasks] = await Promise.all([
            fetchedDeal.accountId
              ? getCrmAccountById(fetchedDeal.accountId.toString())
              : Promise.resolve(null),
            Promise.all(
              (fetchedDeal.contactIds || []).map((id) => getCrmContactById(id.toString())),
            ),
            getCrmTasks(),
          ]);
          setAccount(fetchedAccount);
          setContacts(fetchedContacts.filter(Boolean) as WithId<CrmContact>[]);
          setTasks(fetchedTasks.filter((t) => t.dealId?.toString() === dealId));
        }
      });
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  if (isLoading || !deal) {
    return <DealDetailPageSkeleton />;
  }

  const stageTone = (stage: string): 'green' | 'red' | 'rose-soft' => {
    const s = stage.toLowerCase();
    if (s === 'won') return 'green';
    if (s === 'lost') return 'red';
    return 'rose-soft';
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/dashboard/crm/deals"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-clay-ink-muted hover:text-clay-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Deals Pipeline
        </Link>
      </div>

      <CrmPageHeader
        title={deal.name}
        subtitle="Deal details, related contacts, and tasks"
        icon={Handshake}
        actions={
          <ClayButton
            variant="obsidian"
            disabled={isCreatingInvoice}
            onClick={async () => {
              if (invoiceInFlightRef.current) return;
              invoiceInFlightRef.current = true;
              setIsCreatingInvoice(true);
              try {
                const res = await convertDealToInvoice(deal._id.toString());
                if (res.success) {
                  toast({ title: 'Invoice created' });
                  router.push('/dashboard/crm/sales/invoices');
                } else {
                  toast({
                    title: 'Error',
                    description: res.error,
                    variant: 'destructive',
                  });
                  invoiceInFlightRef.current = false;
                  setIsCreatingInvoice(false);
                }
              } catch (e) {
                invoiceInFlightRef.current = false;
                setIsCreatingInvoice(false);
                throw e;
              }
            }}
            leading={
              isCreatingInvoice ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ReceiptText className="h-4 w-4" />
              )
            }
          >
            Create Invoice
          </ClayButton>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ClayCard>
            <div className="space-y-2">
              <h2 className="text-[16px] font-semibold leading-tight text-clay-ink">
                {deal.name}
              </h2>
              <div>
                <ClayBadge tone={stageTone(deal.stage)}>{deal.stage}</ClayBadge>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-[13px] text-clay-ink">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                <span className="text-[18px] font-semibold text-clay-ink">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: deal.currency,
                  }).format(deal.value)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                <span>
                  Close Date:{' '}
                  {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              {account && (
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                  <Link
                    href={`/dashboard/crm/accounts/${account._id.toString()}`}
                    className="text-clay-rose hover:underline"
                  >
                    {account.name}
                  </Link>
                </div>
              )}
              {contacts.length > 0 && (
                <div className="flex items-start gap-3">
                  <Users className="mt-1 h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                  <div className="flex flex-col">
                    {contacts.map((c) => (
                      <Link
                        key={c._id.toString()}
                        href={`/dashboard/crm/contacts/${c._id.toString()}`}
                        className="text-clay-rose hover:underline"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ClayCard>

          <CrmNotes
            recordId={deal._id.toString()}
            recordType="deal"
            notes={deal.notes || []}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <ClayCard>
            <div className="mb-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                <h2 className="text-[16px] font-semibold text-clay-ink">Related Tasks</h2>
              </div>
              <CreateTaskDialog onTaskCreated={fetchData} dealId={deal._id.toString()} />
            </div>
            <CrmTaskList tasks={tasks} onTaskUpdated={fetchData} />
          </ClayCard>
        </div>
      </div>
    </div>
  );
}
