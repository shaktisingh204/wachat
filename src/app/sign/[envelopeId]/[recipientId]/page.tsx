import { redirect } from 'next/navigation';

/**
 * Path-style signing link (`/sign/<envelopeId>/<recipientId>?t=<token>`).
 * Canonical form is the query-param page (`/sign/<envelopeId>?signerId=…&t=…`),
 * so normalise here and redirect.
 */
export default async function RecipientSignRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ envelopeId: string; recipientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { envelopeId, recipientId } = await params;
  const sp = await searchParams;
  const raw = sp.t;
  const token = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
  redirect(
    `/sign/${encodeURIComponent(envelopeId)}?signerId=${encodeURIComponent(
      recipientId,
    )}&t=${encodeURIComponent(token)}`,
  );
}
