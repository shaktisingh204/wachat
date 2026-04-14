'use client';

import { CalendarDays } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getEmployeeLeaveQuotas,
  saveEmployeeLeaveQuota,
  deleteEmployeeLeaveQuota,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsEmployeeLeaveQuota } from '@/lib/worksuite/hr-ext-types';

export default function EmployeeLeaveQuotasPage() {
  return (
    <HrEntityPage<WsEmployeeLeaveQuota & { _id: string }>
      title="Leave Quotas"
      subtitle="Leave quotas per employee and leave type."
      icon={CalendarDays}
      singular="Quota"
      getAllAction={getEmployeeLeaveQuotas as any}
      saveAction={saveEmployeeLeaveQuota}
      deleteAction={deleteEmployeeLeaveQuota}
      columns={[
        { key: 'user_id', label: 'Employee' },
        { key: 'leave_type_id', label: 'Leave Type' },
        { key: 'no_of_leaves', label: 'Leaves' },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        { name: 'leave_type_id', label: 'Leave Type ID', required: true },
        {
          name: 'no_of_leaves',
          label: 'Number of Leaves',
          type: 'number',
          required: true,
        },
      ]}
    />
  );
}
