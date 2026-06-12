/**
 * PUBLIC SabCRM form render page (`/embed/sabcrm-form/[publicId]`).
 *
 * Unauthenticated by design — the sibling of the legacy
 * `/embed/crm-form/[formId]`. The form is resolved by its public id
 * (24-char hex `_id` or slug) through the UNauthenticated Rust endpoint
 * `GET /v1/sabcrm/forms/public/{publicId}`, which strips tenant ids and
 * post-submit secrets server-side. Submissions go through the public
 * server action, which validates against this same sanitised definition
 * and lets the Rust engine resolve the tenant from the form document.
 */

import * as React from 'react';

import { sabcrmPublicFormsApi } from '@/lib/rust-client/sabcrm-forms';
import {
  SabcrmPublicFormClient,
  type PublicFormView,
} from './page.client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Form',
  robots: { index: false },
};

export default async function SabcrmPublicFormPage(props: {
  params: Promise<{ publicId: string }>;
}): Promise<React.JSX.Element> {
  const { publicId } = await props.params;

  let view: PublicFormView | null = null;
  let unavailable = false;
  try {
    const form = await sabcrmPublicFormsApi.getPublicForm(publicId);
    if (form.status === 'draft') {
      unavailable = true;
    } else {
      view = {
        publicId,
        name: form.name,
        description:
          typeof form.settings?.description === 'string'
            ? form.settings.description
            : '',
        successMessage:
          typeof form.settings?.postSubmit?.successMessage === 'string'
            ? form.settings.postSubmit.successMessage
            : '',
        fields: (form.fields ?? []).map((f) => ({
          name: f.name,
          label: f.label || f.name,
          type: f.type || 'text',
          required: !!f.required,
          placeholder: f.placeholder || '',
          options: f.options ?? [],
        })),
      };
    }
  } catch {
    unavailable = true;
  }

  return <SabcrmPublicFormClient form={view} unavailable={unavailable} />;
}
