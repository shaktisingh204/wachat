/**
 * Edit Proposal Template — server wrapper. Fetches the template and
 * its line items, then renders the edit form (with section editor,
 * variable picker sidebar, and live preview).
 */

import { notFound } from 'next/navigation';

import { getProposalTemplateById } from '@/app/actions/worksuite/proposals.actions';
import { EditTemplateForm, type TemplateFormInitial } from './edit-template-form';

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EditProposalTemplatePage({ params }: PageProps) {
  const { templateId } = await params;
  const data = await getProposalTemplateById(templateId);
  if (!data) notFound();

  const initial: TemplateFormInitial = {
    _id: data.template._id,
    name: data.template.name ?? '',
    title: data.template.title ?? '',
    currency: data.template.currency ?? 'INR',
    discount: data.template.discount ?? 0,
    note: data.template.note ?? '',
    terms: data.template.terms ?? '',
    signatureRequired: data.template.signature_required ?? true,
    sections: data.items.map((it) => ({
      id: it._id,
      title: it.name,
      content: it.description ?? '',
      quantity: Number(it.quantity ?? 1),
      unitPrice: Number(it.unit_price ?? 0),
      tax: Number(it.tax ?? 0),
    })),
  };

  return <EditTemplateForm initial={initial} />;
}
