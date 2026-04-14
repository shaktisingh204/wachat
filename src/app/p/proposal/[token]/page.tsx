import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { ClayBadge, ClayCard } from '@/components/clay';
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { ProposalSignForm } from './_form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'proposal') {
    return <InvalidLinkCard />;
  }
  const { proposal, items, signs } = result.resource as {
    proposal: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
    signs: Array<Record<string, unknown>>;
  };
  const currency = String(proposal.currency || 'INR');
  const isAccepted = proposal.status === 'accepted';
  const signatureRequired = !!proposal.signature_required;

  return (
    <div className="flex flex-col gap-5">
      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
              Proposal
            </p>
            <h1 className="text-[18px] font-semibold text-clay-ink">
              {String(proposal.proposal_number || '')} ·{' '}
              {String(proposal.title || '')}
            </h1>
            <p className="mt-1 text-[12.5px] text-clay-ink-muted">
              Issued {fmtDate(proposal.issue_date)} · Valid until{' '}
              {fmtDate(proposal.valid_until)}
            </p>
          </div>
          <div className="flex gap-2">
            <ClayBadge
              tone={
                isAccepted
                  ? 'green'
                  : proposal.status === 'sent'
                    ? 'amber'
                    : 'neutral'
              }
              dot
            >
              {String(proposal.status || 'draft')}
            </ClayBadge>
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <h2 className="mb-3 text-[15px] font-semibold text-clay-ink">Line items</h2>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full text-[13px]">
            <thead className="bg-clay-surface-2">
              <tr className="border-b border-clay-border">
                <th className="p-3 text-left font-medium text-clay-ink">Item</th>
                <th className="p-3 text-right font-medium text-clay-ink">Qty</th>
                <th className="p-3 text-right font-medium text-clay-ink">Unit</th>
                <th className="p-3 text-right font-medium text-clay-ink">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-clay-border">
                  <td className="p-3 align-top text-clay-ink">
                    <div className="font-medium">{String(it.name || '')}</div>
                    {it.description ? (
                      <div className="mt-0.5 text-[12.5px] text-clay-ink-muted">
                        {String(it.description)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-right align-top text-clay-ink">
                    {Number(it.quantity || 0)}
                  </td>
                  <td className="p-3 text-right align-top text-clay-ink">
                    {fmtCurrency(Number(it.unit_price || 0), currency)}
                  </td>
                  <td className="p-3 text-right align-top font-medium text-clay-ink">
                    {fmtCurrency(Number(it.total || 0), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="p-3 text-right text-clay-ink">
                  Subtotal
                </td>
                <td className="p-3 text-right font-medium text-clay-ink">
                  {fmtCurrency(Number(proposal.subtotal || 0), currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="p-3 text-right text-clay-ink">
                  Tax
                </td>
                <td className="p-3 text-right font-medium text-clay-ink">
                  {fmtCurrency(Number(proposal.tax || 0), currency)}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={3}
                  className="border-t border-clay-border p-3 text-right font-semibold text-clay-ink"
                >
                  Total
                </td>
                <td className="border-t border-clay-border p-3 text-right font-semibold text-clay-ink">
                  {fmtCurrency(Number(proposal.total || 0), currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {proposal.note || proposal.terms ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {proposal.note ? (
              <div>
                <p className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
                  Notes
                </p>
                <pre className="whitespace-pre-wrap rounded-clay-md border border-clay-border bg-clay-surface-2 p-3 font-sans text-[13px] text-clay-ink">
                  {String(proposal.note)}
                </pre>
              </div>
            ) : null}
            {proposal.terms ? (
              <div>
                <p className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-clay-ink-muted">
                  Terms &amp; conditions
                </p>
                <pre className="whitespace-pre-wrap rounded-clay-md border border-clay-border bg-clay-surface-2 p-3 font-sans text-[13px] text-clay-ink">
                  {String(proposal.terms)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </ClayCard>

      {isAccepted ? (
        <ClayCard>
          <h2 className="text-[15px] font-semibold text-clay-ink">
            Accepted &amp; signed
          </h2>
          {signs.length === 0 ? (
            <p className="mt-2 text-[13px] text-clay-ink-muted">
              No signature records on file.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {signs.map((s, i) => (
                <div
                  key={i}
                  className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-4"
                >
                  <p className="text-[13px] font-medium text-clay-ink">
                    {String(s.signer_name || '')}
                  </p>
                  <p className="text-[11.5px] text-clay-ink-muted">
                    {String(s.signer_email || '')}
                  </p>
                  <p className="mt-2 text-[11.5px] text-clay-ink-muted">
                    Signed {fmtDateTime(s.signed_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ClayCard>
      ) : signatureRequired ? (
        <ProposalSignForm token={token} />
      ) : null}
    </div>
  );
}
