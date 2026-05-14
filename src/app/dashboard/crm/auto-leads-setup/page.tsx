import { Sparkles } from 'lucide-react';

import { getAutoLeadRules } from '@/app/actions/crm-auto-leads.actions';
import { AutoLeadsWizard } from './_components/auto-leads-wizard';

export const dynamic = 'force-dynamic';

export default async function AutoLeadsSetupPage() {
  const rules = await getAutoLeadRules();
  // Serialize ObjectId / Date for client component
  const initialRules = JSON.parse(JSON.stringify(rules)) as Array<{
    _id: string;
    name: string;
    source: string;
    keyword: string;
    leadSource: string;
    createdAt?: string;
  }>;

  return <AutoLeadsWizard initialRules={initialRules} />;
}
