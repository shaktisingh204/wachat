'use client';

import { Tags } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getContractTypes,
  saveContractType,
  deleteContractType,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractType } from '@/lib/worksuite/contracts-ext-types';

export default function ContractTypesPage() {
  return (
    <HrEntityPage<WsContractType & { _id: string }>
      title="Contract Types"
      subtitle="Classification tags for contracts (retainer, project, NDA, etc.)."
      icon={Tags}
      singular="Type"
      getAllAction={getContractTypes as any}
      saveAction={saveContractType}
      deleteAction={deleteContractType}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[
        { name: 'name', label: 'Type Name', required: true, fullWidth: true },
      ]}
    />
  );
}
