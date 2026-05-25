import * as React from 'react';
import {
  getFacebookPagesForAdCreation,
  listLeadGenForms,
  getCrmLeadGenSyncStatus,
} from '@/app/actions/ad-manager.actions';
import LeadFormsClient from './lead-forms-client';

export const metadata = {
  title: 'Lead Forms - Ad Manager',
  description: 'Manage and sync Meta lead generation forms',
};

export default async function LeadFormsPage() {
  const pagesRes = await getFacebookPagesForAdCreation();
  const pages = pagesRes.pages || [];
  
  let initialForms: any[] = [];
  let initialSelectedPage = '';
  
  if (pages.length > 0) {
    initialSelectedPage = pages[0].id;
    const formsRes = await listLeadGenForms(initialSelectedPage);
    initialForms = formsRes.data || [];
  }
  
  const initialCrmStatus = await getCrmLeadGenSyncStatus();

  return (
    <LeadFormsClient 
      initialPages={pages}
      initialForms={initialForms}
      initialSelectedPage={initialSelectedPage}
      initialCrmStatus={initialCrmStatus}
    />
  );
}
