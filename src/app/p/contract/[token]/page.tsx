import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { ClayBadge, ClayCard } from '@/components/clay';
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ContractSignForm } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicContractPage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'contract') {
    return <InvalidLinkCard />;
  }
  const { contract, signs } = result.resource as {
    contract: Record<string, unknown>;
    signs: Array<Record<string, unknown>>;
  };
  const isSigned = !!contract.signed || signs.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
              Contract
            </p>
            <h1 className="text-[18px] font-semibold text-foreground">
              {String(contract.subject || contract.name || 'Contract')}
            </h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {fmtDate(contract.start_date)} → {fmtDate(contract.end_date)}
            </p>
          </div>
          <ClayBadge tone={isSigned ? 'green' : 'amber'} dot>
            {isSigned ? 'signed' : 'pending'}
          </ClayBadge>
        </div>
        {contract.value ? (
          <p className="mt-3 text-[13px] text-foreground">
            Value:{' '}
            <strong>
              {fmtCurrency(Number(contract.value), String(contract.currency || 'INR'))}
            </strong>
          </p>
        ) : null}
        {contract.description ? (
          <div className="mt-4 rounded-lg border border-border bg-secondary p-3 text-[13px] text-foreground">
            <pre className="whitespace-pre-wrap font-sans">
              {String(contract.description)}
            </pre>
          </div>
        ) : null}
      </ClayCard>

      {isSigned ? (
        <ClayCard>
          <h2 className="text-[15px] font-semibold text-foreground">Signed</h2>
          <div className="mt-3 space-y-3">
            {signs.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-secondary p-4"
              >
                <p className="text-[13px] font-medium text-foreground">
                  {String(s.signer_name || '')}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {String(s.signer_email || '')}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Signed {fmtDateTime(s.signed_at)}
                </p>
              </div>
            ))}
          </div>
        </ClayCard>
      ) : (
        <ContractSignForm token={token} />
      )}
    </div>
  );
}
