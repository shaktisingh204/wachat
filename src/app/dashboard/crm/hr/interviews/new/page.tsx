'use client';

/**
 * Interview /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?candidateId=…              → prefill linked candidate
 *   ?fromKind=candidate&fromId  → prefill linked candidate
 *   ?roundNumber=…              → prefill round
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveInterview } from '@/app/actions/hr.actions';

export default function NewInterviewPage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    const candidateId =
      sp.get('candidateId') || (fromKind === 'candidate' ? fromId : null);
    if (candidateId) out.candidateId = candidateId;
    if (sp.get('roundNumber')) out.roundNumber = sp.get('roundNumber');
    out.result = 'pending';
    out.type = 'video';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Interview"
      subtitle="Schedule an interview round."
      icon={Calendar}
      backHref="/dashboard/crm/hr/interviews"
      singular="Interview"
      fields={fields}
      sections={sections}
      saveAction={saveInterview}
      initial={initial}
    />
  );
}
