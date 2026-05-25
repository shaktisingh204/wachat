import { loadPublicLeadForm } from '@/app/actions/worksuite/public.actions';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { LeadFormRenderer } from './_form';
import { PayloadContractCard } from './_components/payload-contract';
import type { LeadFormResponse } from './types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formId: string }>;
}

export default async function PublicLeadFormPage({ params }: PageProps) {
  const { formId } = await params;
  const form = (await loadPublicLeadForm(formId)) as LeadFormResponse | null;
  
  if (!form) return <InvalidLinkCard message="This form is unavailable." />;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* LEFT COLUMN: Specification & Documentation (60%) */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-blue-600 uppercase">
              GET
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
              /v1/lead-forms/{formId.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            Tell us about yourself
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Complete this form to submit your details directly to our CRM endpoint.
          </p>
        </div>

        {/* PARAMETER SCHEMA */}
        <PayloadContractCard fields={form.fields} />
      </div>

      {/* RIGHT COLUMN: Active Request Form & JSON Runner (40%) */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-green-600 uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
              /v1/lead-forms/{formId.slice(0, 8)}.../submit
            </span>
          </div>

          <LeadFormRenderer formId={formId} fields={form.fields} />
        </div>
      </div>
    </div>
  );
}
