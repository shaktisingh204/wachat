import * as React from 'react';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { getPublicLeadForm } from '@/app/actions/public-lead-form.actions';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { LeadFormClient } from './lead-form-client';

export const dynamic = 'force-dynamic';

type Params = Promise<{ formId: string }>;

async function PublicLeadFormContainer({ formId }: { formId: string }) {
  const form = await getPublicLeadForm(formId);
  if (!form) notFound();

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  return (
    <>
      {recaptchaSiteKey && (
        <Script src="https://www.google.com/recaptcha/api.js" strategy="lazyOnload" />
      )}
      <Card>
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          {form.description ? (
            <p className="text-sm text-[var(--st-text)]">{form.description}</p>
          ) : null}
        </CardHeader>
        <CardBody>
          <LeadFormClient
            formId={form._id}
            fields={form.fields}
            thankYouMessage={form.thankYouMessage}
            consentEnabled={form.consentEnabled}
            consentText={form.consentText}
            recaptchaSiteKey={recaptchaSiteKey}
          />
        </CardBody>
      </Card>
    </>
  );
}

export default async function PublicLeadFormPage({ params }: { params: Params }) {
  const { formId } = await params;
  
  return (
    <React.Suspense fallback={<div>Loading form...</div>}>
      <PublicLeadFormContainer formId={formId} />
    </React.Suspense>
  );
}
