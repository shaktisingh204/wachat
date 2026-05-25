import React from 'react';
import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { getOnboardingKpis, getOnboardings } from '@/app/actions/crm-onboarding.actions';
import { getJobs } from '@/app/actions/crm-jobs.actions';
import { getAnnouncements } from '@/app/actions/crm-announcements.actions';
import { getPolicies } from '@/app/actions/crm-policies.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { HrOverviewClient } from './_components/hr-overview-client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch HR data in parallel to maximize performance
  const [
    onboardingKpis,
    onboardingsRes,
    jobsRes,
    announcementsRes,
    policiesRes,
    employeesList,
  ] = await Promise.all([
    getOnboardingKpis(),
    getOnboardings({ limit: 10 }),
    getJobs({ limit: 10 }),
    getAnnouncements({ limit: 10 }),
    getPolicies({ limit: 10 }),
    getCrmEmployees(),
  ]);

  // Safely extract arrays, defaulting to empty arrays if undefined
  const rawOnboardings = onboardingsRes?.items || [];
  const rawJobs = jobsRes?.items || [];
  const rawAnnouncements = announcementsRes?.items || [];
  const rawPolicies = policiesRes?.items || [];
  const rawEmployees = employeesList || [];

  // Use proper DTO mappers rather than double-serializing the entire payload
  const activeOnboardings = rawOnboardings.map(o => ({ ...o, _id: String(o._id) }));
  const jobs = rawJobs.map(j => ({ ...j, _id: String(j._id) }));
  const announcements = rawAnnouncements.map(a => ({ ...a, _id: String(a._id) }));
  const policies = rawPolicies.map(p => ({ ...p, _id: String(p._id) }));

  const totalEmployeesCount = rawEmployees.length;
  const activeEmployeesCount = rawEmployees.filter((e: any) => e?.status?.toLowerCase() === 'active').length || totalEmployeesCount;

  return (
    <div className="p-6">
      <HrOverviewClient
        onboardingKpis={onboardingKpis}
        activeOnboardings={activeOnboardings}
        jobs={jobs}
        announcements={announcements}
        policies={policies}
        activeEmployeesCount={activeEmployeesCount}
        totalEmployeesCount={totalEmployeesCount}
        userName={session.user.name || 'Manager'}
      />
    </div>
  );
}
