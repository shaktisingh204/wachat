'use client';

/**
 * Offer /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?candidateId=…              → prefill linked candidate
 *   ?fromKind=candidate&fromId  → prefill linked candidate
 *   ?designation=…              → prefill designation
 *   ?department=…               → prefill department
 *   ?ctc=…                      → prefill CTC
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOfferLetter } from '@/app/actions/hr.actions';

export default function NewOfferPage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    const candidateId =
      sp.get('candidateId') || (fromKind === 'candidate' ? fromId : null);
    if (candidateId) out.candidateId = candidateId;
    if (sp.get('designation')) out.designation = sp.get('designation');
    if (sp.get('department')) out.department = sp.get('department');
    if (sp.get('ctc')) out.ctc = sp.get('ctc');
    out.status = 'pending';
    out.probationMonths = '3';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Offer"
      subtitle="Draft an offer letter for a candidate."
      icon={Send}
      backHref="/dashboard/hrm/hr/offers"
      singular="Offer"
      fields={fields}
      sections={sections}
      saveAction={saveOfferLetter}
      initial={initial}
    />
  );
}
