import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { getCustomFields } from '@/app/actions/crm-custom-fields.actions';
import {
  FieldsManager,
  type CustomFieldLite,
} from './_components/fields-manager';

export const dynamic = 'force-dynamic';

function toLite(docs: Awaited<ReturnType<typeof getCustomFields>>): CustomFieldLite[] {
  return docs.map((d) => ({
    id: String(d._id),
    entityKind: d.entityKind,
    name: d.name,
    label: d.label,
    fieldType: d.fieldType,
    required: Boolean(d.required),
    isActive: Boolean(d.isActive),
  }));
}

export default async function SabbiginFieldsSettingsPage() {
  const [deal, contact, company] = await Promise.all([
    getCustomFields('deal'),
    getCustomFields('contact'),
    getCustomFields('company'),
  ]);

  const fieldsByModule = {
    deal: toLite(deal),
    contact: toLite(contact),
    company: toLite(company),
  };

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
          <PageTitle>Custom fields</PageTitle>
          <PageDescription>
            Add fields to deals, contacts, and companies to capture data
            specific to your business. New fields appear on records and in the
            REST API.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <FieldsManager fieldsByModule={fieldsByModule} />
    </div>
  );
}
