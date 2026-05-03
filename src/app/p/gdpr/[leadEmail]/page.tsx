import { loadPublicConsentContext } from '@/app/actions/worksuite/public.actions';
import { ClayCard } from '@/components/clay';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ConsentForm } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ leadEmail: string }>;
}

export default async function PublicGdprPage({ params }: PageProps) {
  const { leadEmail: raw } = await params;
  const leadEmail = decodeURIComponent(raw);
  const ctx = await loadPublicConsentContext(leadEmail);
  if (!ctx) {
    return <InvalidLinkCard message="No consent profile found for this email." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
          Privacy preferences
        </p>
        <h1 className="mt-1 text-[18px] font-semibold text-foreground">
          Manage your consent
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Review the purposes below and choose what you&apos;re comfortable with.
          Your preferences will be recorded against {ctx.lead.email}.
        </p>
      </ClayCard>
      <ConsentForm leadEmail={leadEmail} purposes={ctx.purposes} />
    </div>
  );
}
