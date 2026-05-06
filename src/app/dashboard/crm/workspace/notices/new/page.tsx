'use client';
import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Megaphone, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

import { saveNotice } from '@/app/actions/worksuite/knowledge.actions';

export default function NewNoticePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveNotice, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/workspace/notices');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Notice"
        subtitle="Publish a notice to your team."
        icon={Megaphone}
      />

      <ZoruCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="heading" className="text-foreground">Heading *</ZoruLabel>
            <ZoruInput id="heading" name="heading" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <ZoruLabel htmlFor="description" className="text-foreground">Description *</ZoruLabel>
            <ZoruTextarea id="description" name="description" rows={6} required className="mt-1.5" />
          </div>

          <div>
            <ZoruLabel htmlFor="notice_to" className="text-foreground">Audience</ZoruLabel>
            <ZoruSelect name="notice_to" defaultValue="all">
              <ZoruSelectTrigger id="notice_to" className="mt-1.5 h-10">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Everyone</ZoruSelectItem>
                <ZoruSelectItem value="department">Department</ZoruSelectItem>
                <ZoruSelectItem value="employee">Specific employees</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div>
            <ZoruLabel htmlFor="pinned" className="text-foreground">Pinned</ZoruLabel>
            <ZoruSelect name="pinned" defaultValue="false">
              <ZoruSelectTrigger id="pinned" className="mt-1.5 h-10">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <input type="hidden" name="file_attached" value="false" />

          <div className="md:col-span-2 flex justify-end gap-2">
            <ZoruButton variant="outline" type="button" onClick={() => router.back()}>
              Cancel
            </ZoruButton>
            <ZoruButton
             
              type="submit"
              disabled={isPending}
             
            >
              Publish
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
