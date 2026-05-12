import { BadgeCheck } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DesignationForm } from '../_components/designation-form';

export const dynamic = 'force-dynamic';

export default function NewDesignationPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title="New designation" subtitle="Add a role." icon={BadgeCheck} />
      <DesignationForm />
    </div>
  );
}
