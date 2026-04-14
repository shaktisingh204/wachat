'use client';

import { Plane } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getVisaDetails,
  saveVisaDetail,
  deleteVisaDetail,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsVisaDetail } from '@/lib/worksuite/hr-ext-types';

export default function VisaDetailsPage() {
  return (
    <HrEntityPage<WsVisaDetail & { _id: string }>
      title="Visa Details"
      subtitle="Track employee work visas and expiry dates."
      icon={Plane}
      singular="Visa"
      getAllAction={getVisaDetails as any}
      saveAction={saveVisaDetail}
      deleteAction={deleteVisaDetail}
      columns={[
        { key: 'user_id', label: 'Employee' },
        { key: 'country', label: 'Country' },
        { key: 'visa_number', label: 'Visa #' },
        {
          key: 'issue_date',
          label: 'Issued',
          render: (r) => (r.issue_date ? new Date(r.issue_date).toLocaleDateString() : '—'),
        },
        {
          key: 'expiry_date',
          label: 'Expires',
          render: (r) => (r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '—'),
        },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        { name: 'country', label: 'Country', required: true },
        { name: 'visa_number', label: 'Visa Number' },
        { name: 'issue_date', label: 'Issue Date', type: 'date' },
        { name: 'expiry_date', label: 'Expiry Date', type: 'date' },
        { name: 'file', label: 'File URL', type: 'url', fullWidth: true },
      ]}
    />
  );
}
