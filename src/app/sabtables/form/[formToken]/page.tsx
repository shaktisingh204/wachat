import { notFound } from 'next/navigation';

import { sabtablesViewsApi } from '@/lib/rust-client/sabtables-views';
import { sabtablesTablesApi } from '@/lib/rust-client/sabtables-tables';

import { PublicFormClient } from './_components/public-form-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formToken: string }>;
}

/**
 * Public form-share page. Resolves `formToken` -> view via the Rust
 * `/v1/sabtables/views/form/:token` endpoint and renders the form.
 * No auth required — the endpoint is intentionally public for form
 * collection.
 */
export default async function PublicFormPage({ params }: PageProps) {
  const { formToken } = await params;
  const view = await sabtablesViewsApi.getByFormToken(formToken).catch(() => null);
  if (!view) notFound();
  const table = await sabtablesTablesApi.getById(view.tableId).catch(() => null);
  if (!table) notFound();
  return <PublicFormClient view={view} table={table} />;
}
