import { loadPublicLeadForm } from '@/app/actions/worksuite/public.actions';
import { ClayCard } from '@/components/clay';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { LeadFormRenderer } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formId: string }>;
}

export default async function PublicLeadFormPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await loadPublicLeadForm(formId);
  if (!form) return <InvalidLinkCard message="This form is unavailable." />;

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
          Contact form
        </p>
        <h1 className="mt-1 text-[18px] font-semibold text-clay-ink">
          Tell us about yourself
        </h1>
        <p className="mt-1 text-[12.5px] text-clay-ink-muted">
          Complete this form and we&apos;ll get back to you as soon as possible.
        </p>
      </ClayCard>
      <LeadFormRenderer formId={formId} fields={form.fields} />
    </div>
  );
}
