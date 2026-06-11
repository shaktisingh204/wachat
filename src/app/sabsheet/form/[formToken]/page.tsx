import { notFound } from 'next/navigation';

import { connectToDatabase } from '@/lib/mongodb';
import {
  COLL_SABSHEET_FORMS,
  type SabsheetForm,
  type SabsheetFormField,
} from '@/lib/sabsheet/forms/types';

import { PublicFormClient } from './_components/public-form-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ formToken: string }>;
}

function sanitizeFields(raw: unknown): SabsheetFormField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => {
      const allowed = ['text', 'number', 'email', 'date', 'select'] as const;
      const type = (allowed as readonly string[]).includes(f.type as string)
        ? (f.type as SabsheetFormField['type'])
        : 'text';
      const field: SabsheetFormField = {
        columnIndex: Number(f.columnIndex) || 0,
        label: typeof f.label === 'string' ? f.label : '',
        type,
        required: Boolean(f.required),
      };
      if (type === 'select' && Array.isArray(f.options)) {
        field.options = f.options.filter((o): o is string => typeof o === 'string');
      }
      return field;
    });
}

/**
 * Public SabSheet form page. Resolves `formToken` → form doc directly from
 * Mongo (NO auth — the form is intentionally public for collection), then
 * renders the client form. `notFound()` on miss or closed form.
 */
export default async function PublicSabsheetFormPage({ params }: PageProps) {
  const { formToken } = await params;
  if (!formToken) notFound();

  const { db } = await connectToDatabase();
  const doc = await db
    .collection(COLL_SABSHEET_FORMS)
    .findOne({ token: formToken });
  if (!doc) notFound();

  // Only expose the fields a respondent needs — never owner/workbook ids.
  const form: Pick<SabsheetForm, 'token' | 'title' | 'description' | 'fields' | 'status'> = {
    token: String(doc.token),
    title: doc.title ?? 'Form',
    description: doc.description ?? undefined,
    fields: sanitizeFields(doc.fields),
    status: doc.status === 'closed' ? 'closed' : 'active',
  };

  return <PublicFormClient form={form} />;
}
