'use client';

/**
 * Candidate /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?jobId=…              → prefill linked job
 *   ?fromKind=job&fromId  → prefill linked job
 *   ?source=…             → prefill source
 *   ?ownerId=…            → prefill owner
 *
 * Uses the same shared <HrFormPage> sectioned-cards renderer the
 * other HR pillars use; every entity-ref is an <EntityFormField>.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Target } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveCandidate } from '@/app/actions/hr.actions';

export default function NewCandidatePage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    const jobId = sp.get('jobId') || (fromKind === 'job' ? fromId : null);
    const source = sp.get('source');
    const out: Record<string, unknown> = {};
    if (jobId) out.jobId = jobId;
    if (source) out.source = source;
    if (sp.get('ownerId')) out.ownerId = sp.get('ownerId');
    out.applied_at = new Date().toISOString().slice(0, 10);
    out.stage = 'applied';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Candidate"
      subtitle="Add a candidate to the recruitment pipeline."
      icon={Target}
      backHref="/dashboard/crm/hr/candidates"
      singular="Candidate"
      fields={fields}
      sections={sections}
      saveAction={saveCandidate}
      initial={initial}
    />
  );
}
