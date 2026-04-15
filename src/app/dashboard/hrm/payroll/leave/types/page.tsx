'use client';

import { Tags } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getLeaveTypes,
  saveLeaveType,
  deleteLeaveType,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';

export default function LeaveTypesPage() {
  return (
    <HrEntityPage<WsLeaveType & { _id: string }>
      title="Leave Types"
      subtitle="Define leave categories with annual quota, color, monthly cap, and paid status."
      icon={Tags}
      singular="Leave Type"
      getAllAction={getLeaveTypes as any}
      saveAction={saveLeaveType}
      deleteAction={deleteLeaveType}
      columns={[
        {
          key: 'type_name',
          label: 'Type',
          render: (row) => (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full border border-clay-border"
                style={{ backgroundColor: row.color || '#94A3B8' }}
              />
              <span className="font-medium">{row.type_name}</span>
            </span>
          ),
        },
        { key: 'no_of_leaves', label: 'Per Year' },
        { key: 'monthly_limit', label: 'Monthly Cap' },
        { key: 'leave_unit', label: 'Unit' },
        {
          key: 'paid',
          label: 'Paid',
          render: (row) => (row.paid ? 'Yes' : 'No'),
        },
        { key: 'status', label: 'Status' },
      ]}
      fields={[
        { name: 'type_name', label: 'Type Name', required: true, fullWidth: true },
        {
          name: 'no_of_leaves',
          label: 'Leaves Per Year',
          type: 'number',
          required: true,
        },
        {
          name: 'monthly_limit',
          label: 'Monthly Limit',
          type: 'number',
          defaultValue: '0',
        },
        {
          name: 'color',
          label: 'Color (hex)',
          defaultValue: '#EAB308',
          placeholder: '#EAB308',
        },
        {
          name: 'leave_unit',
          label: 'Leave Unit',
          type: 'select',
          options: [
            { value: 'days', label: 'Days' },
            { value: 'hours', label: 'Hours' },
            { value: 'half-days', label: 'Half Days' },
          ],
          defaultValue: 'days',
        },
        {
          name: 'paid',
          label: 'Paid',
          type: 'select',
          options: [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ],
          defaultValue: 'true',
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
          defaultValue: 'active',
        },
      ]}
    />
  );
}
