'use client';

import { PhoneCall } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getEmergencyContacts,
  saveEmergencyContact,
  deleteEmergencyContact,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsEmergencyContact } from '@/lib/worksuite/hr-ext-types';

export default function EmergencyContactsPage() {
  return (
    <HrEntityPage<WsEmergencyContact & { _id: string }>
      title="Emergency Contacts"
      subtitle="Emergency contact details for each employee."
      icon={PhoneCall}
      singular="Contact"
      getAllAction={getEmergencyContacts as any}
      saveAction={saveEmergencyContact}
      deleteAction={deleteEmergencyContact}
      columns={[
        { key: 'user_id', label: 'Employee' },
        { key: 'name', label: 'Name' },
        { key: 'relation', label: 'Relation' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        { name: 'name', label: 'Contact Name', required: true },
        { name: 'relation', label: 'Relation' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'address', label: 'Address', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
