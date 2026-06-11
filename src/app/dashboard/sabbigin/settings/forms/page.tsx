import Link from 'next/link';
import { ArrowLeft, Inbox, Plus } from 'lucide-react';

import {
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import { getCrmForms } from '@/app/actions/crm-forms.actions';
import { FormsList, type FormLite } from './_components/forms-list';

export const dynamic = 'force-dynamic';

const NEW_FORM_HREF = '/dashboard/sabbigin/settings/integrations';

export default async function SabbiginFormsSettingsPage() {
  const { forms } = await getCrmForms(1, 50);

  const lite: FormLite[] = forms.map((f) => ({
    id: String(f._id),
    name: f.name,
    submissionCount: typeof f.submissionCount === 'number' ? f.submissionCount : 0,
  }));

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              Settings
            </Link>
          </PageEyebrow>
          <PageTitle>Web forms</PageTitle>
          <PageDescription>
            Lead-capture forms you can share as a hosted link or embed on your
            site. Submissions create contacts and leads automatically.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link href={NEW_FORM_HREF} className="u-btn u-btn--primary u-btn--sm">
            <Plus size={13} aria-hidden="true" />
            <span className="u-btn__label">New form</span>
          </Link>
        </PageActions>
      </PageHeader>

      {lite.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No web forms yet"
          description="Build a lead-capture form, then share its hosted link or embed it on your website to start collecting submissions."
          action={
            <Link href={NEW_FORM_HREF} className="u-btn u-btn--primary u-btn--sm">
              <span className="u-btn__label">Create your first form</span>
            </Link>
          }
        />
      ) : (
        <FormsList forms={lite} />
      )}
    </div>
  );
}
