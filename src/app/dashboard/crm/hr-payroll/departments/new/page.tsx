import { Building2 } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DepartmentForm } from '../_components/department-form';

export const dynamic = 'force-dynamic';

export default function NewDepartmentPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title="New department" subtitle="Add an organizational unit." icon={Building2} />
      <DepartmentForm />
    </div>
  );
}
