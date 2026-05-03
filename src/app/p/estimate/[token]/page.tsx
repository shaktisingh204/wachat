import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { ClayBadge, ClayCard } from '@/components/clay';
import { fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { EstimateAcceptForm } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicEstimatePage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'estimate') {
    return <InvalidLinkCard />;
  }
  const { estimate, acceptances } = result.resource as {
    estimate: Record<string, unknown>;
    acceptances: Array<Record<string, unknown>>;
  };
  const accepted = acceptances.length > 0 || estimate.status === 'quoted';

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
              Estimate request
            </p>
            <h1 className="text-[18px] font-semibold text-foreground">
              {String(
                estimate.requester_name ||
                  estimate.description?.toString().slice(0, 60) ||
                  'Estimate',
              )}
            </h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Desired {fmtDate(estimate.desired_date)}
            </p>
          </div>
          <ClayBadge tone={accepted ? 'green' : 'amber'} dot>
            {String(estimate.status || 'pending')}
          </ClayBadge>
        </div>
        {estimate.description ? (
          <div className="mt-4 rounded-lg border border-border bg-secondary p-3 text-[13px] text-foreground">
            <pre className="whitespace-pre-wrap font-sans">
              {String(estimate.description)}
            </pre>
          </div>
        ) : null}
        {estimate.notes ? (
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Notes: {String(estimate.notes)}
          </p>
        ) : null}
      </ClayCard>

      {accepted ? (
        <ClayCard>
          <h2 className="text-[15px] font-semibold text-foreground">Accepted</h2>
          <div className="mt-3 space-y-3">
            {acceptances.map((a, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-secondary p-4"
              >
                <p className="text-[13px] font-medium text-foreground">
                  {String(a.accepted_by_name || '')}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {String(a.accepted_by_email || '')}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Accepted {fmtDateTime(a.accepted_at)}
                </p>
              </div>
            ))}
          </div>
        </ClayCard>
      ) : (
        <EstimateAcceptForm token={token} />
      )}
    </div>
  );
}
