import { loadPublicTicketForm } from '@/app/actions/worksuite/public.actions';
import { ClayCard } from '@/components/clay';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { TicketFormRenderer } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formId: string }>;
}

export default async function PublicTicketFormPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await loadPublicTicketForm(formId);
  if (!form) return <InvalidLinkCard message="This form is unavailable." />;

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
          Support ticket
        </p>
        <h1 className="mt-1 text-[18px] font-semibold text-foreground">
          Open a ticket
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Describe the issue and we will get back to you.
        </p>
      </ClayCard>
      <TicketFormRenderer formId={formId} fields={form.fields} />
    </div>
  );
}
