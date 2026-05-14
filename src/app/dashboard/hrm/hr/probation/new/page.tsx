'use client';

/**
 * Probation /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?employeeId=…                   → prefill employee
 *   ?fromKind=onboarding&fromId=…   → prefill employee (when onboarding
 *                                      id is the seed)
 *   ?fromKind=offer&fromId=…        → prefill employee
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveProbation } from '@/app/actions/hr.actions';

export default function NewProbationPage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    const employeeId =
      sp.get('employeeId') ||
      (fromKind === 'onboarding' || fromKind === 'offer' || fromKind === 'candidate'
        ? fromId
        : null);
    if (employeeId) out.employeeId = employeeId;
    const today = new Date();
    const inThreeMonths = new Date(today);
    inThreeMonths.setMonth(today.getMonth() + 3);
    out.startDate = today.toISOString().slice(0, 10);
    out.endDate = inThreeMonths.toISOString().slice(0, 10);
    out.status = 'ongoing';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Probation"
      subtitle="Start a probation period for an employee."
      icon={ShieldCheck}
      backHref="/dashboard/hrm/hr/probation"
      singular="Probation"
      fields={fields}
      sections={sections}
      saveAction={saveProbation}
      initial={initial}
    />
  );
}
