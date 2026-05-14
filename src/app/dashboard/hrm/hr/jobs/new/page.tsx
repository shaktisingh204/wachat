'use client';

/**
 * Job /new — §1D.3 form per spec.
 *
 * Smart defaults from query:
 *   ?departmentId=…       → prefill department
 *   ?designationId=…      → prefill designation
 *   ?recruiterId=…        → prefill recruiter
 *   ?location=…           → prefill location
 *   ?fromKind=…&fromId=…  → forwarded as kind/id pair
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Briefcase } from 'lucide-react';

import { HrFormPage } from '../../_components/hr-form-page';
import { fields, sections } from '../_config';
import { saveJobPosting } from '@/app/actions/hr.actions';

export default function NewJobPage() {
  const sp = useSearchParams();
  const initial = React.useMemo(() => {
    const out: Record<string, unknown> = {};
    const fromKind = sp.get('fromKind');
    const fromId = sp.get('fromId');
    if (sp.get('departmentId')) out.departmentId = sp.get('departmentId');
    else if (fromKind === 'department' && fromId) out.departmentId = fromId;
    if (sp.get('designationId')) out.designationId = sp.get('designationId');
    if (sp.get('recruiterId')) out.recruiterId = sp.get('recruiterId');
    if (sp.get('location')) out.location = sp.get('location');
    out.status = 'draft';
    out.employmentType = 'full-time';
    out.visibility = 'public';
    return out;
  }, [sp]);

  return (
    <HrFormPage
      title="New Job"
      subtitle="Create a job posting for the hiring pipeline."
      icon={Briefcase}
      backHref="/dashboard/hrm/hr/jobs"
      singular="Job"
      fields={fields}
      sections={sections}
      saveAction={saveJobPosting}
      initial={initial}
    />
  );
}
