'use client';

/**
 * Onboarding /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?employeeId=…                → prefill employee
 *   ?fromKind=offer&fromId=…     → prefill employee (when offer/candidate
 *                                   id is the seed)
 *   ?fromKind=candidate&fromId   → prefill employee
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { UserCheck } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveOnboardingTemplate } from '@/app/actions/hr.actions';

export default function NewOnboardingPage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    const employeeId =
      sp.get('employeeId') ||
      (fromKind === 'offer' || fromKind === 'candidate' ? fromId : null);
    if (employeeId) out.employee_id = employeeId;
    out.status = 'pending';
    out.category = 'paperwork';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Onboarding"
      subtitle="Create an onboarding task or template."
      icon={UserCheck}
      backHref="/dashboard/hrm/hr/onboarding"
      singular="Onboarding"
      fields={fields}
      sections={sections}
      saveAction={saveOnboardingTemplate}
      initial={initial}
    />
  );
}
