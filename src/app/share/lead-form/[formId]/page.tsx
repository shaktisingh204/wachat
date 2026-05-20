import { notFound } from 'next/navigation';
import { getPublicLeadForm } from '@/app/actions/public-lead-form.actions';
import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { LeadFormClient } from './lead-form-client';

type Params = Promise<{ formId: string }>;

export default async function PublicLeadFormPage({ params }: { params: Params }) {
  const { formId } = await params;
  const form = await getPublicLeadForm(formId);
  if (!form) notFound();

  return (
    <ZoruCard>
      <ZoruCardHeader>
        <ZoruCardTitle>{form.title}</ZoruCardTitle>
        {form.description ? (
          <p className="text-sm text-zinc-600">{form.description}</p>
        ) : null}
      </ZoruCardHeader>
      <ZoruCardContent>
        <LeadFormClient
          formId={form._id}
          fields={form.fields}
          thankYouMessage={form.thankYouMessage}
          consentEnabled={form.consentEnabled}
          consentText={form.consentText}
        />
      </ZoruCardContent>
    </ZoruCard>
  );
}
