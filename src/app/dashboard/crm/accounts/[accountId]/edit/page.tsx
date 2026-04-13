'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmAccountById, updateCrmAccount } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmAccount } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

const initialState = { message: null, error: null, accountId: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={
        pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Save className="h-4 w-4" strokeWidth={1.75} />
        )
      }
    >
      Save Changes
    </ClayButton>
  );
}

export default function EditCrmAccountPage() {
  const params = useParams();
  const accountId = params.accountId as string;

  const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
  const [isLoading, startLoading] = useTransition();

  const [state, formAction] = useActionState(updateCrmAccount as any, initialState as any);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (accountId) {
      startLoading(async () => {
        const fetchedAccount = await getCrmAccountById(accountId);
        setAccount(fetchedAccount);
      });
    }
  }, [accountId]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      // Force a full page reload to ensure data is fresh, bypassing client-side router cache.
      if (state.accountId) {
        window.location.href = `/dashboard/crm/accounts/${state.accountId}`;
      } else {
        window.location.href = '/dashboard/crm/accounts';
      }
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  if (isLoading || !account) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-96 w-full rounded-clay-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/crm/accounts/${accountId}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-clay-ink-muted hover:text-clay-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Back to Account
        </Link>
      </div>

      <CrmPageHeader
        title="Edit Account"
        subtitle={`Update the details for ${account.name}.`}
        icon={Building}
      />

      <form action={formAction} ref={formRef}>
        <input type="hidden" name="accountId" value={account._id.toString()} />
        <ClayCard>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[12.5px] text-clay-ink-muted">
                Company Name
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={account.name}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-[12.5px] text-clay-ink-muted">
                Industry
              </Label>
              <Input
                id="industry"
                name="industry"
                defaultValue={account.industry}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website" className="text-[12.5px] text-clay-ink-muted">
                  Website
                </Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  placeholder="https://example.com"
                  defaultValue={account.website}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[12.5px] text-clay-ink-muted">
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={account.phone}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end border-t border-clay-border pt-4">
            <SubmitButton />
          </div>
        </ClayCard>
      </form>
    </div>
  );
}
