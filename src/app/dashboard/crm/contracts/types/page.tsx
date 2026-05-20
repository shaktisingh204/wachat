'use client';

/**
 * Contract Types — settings-list with light Deep treatment.
 *
 * KPI · search/status filter · bulk delete · CSV/XLSX export ·
 * RowDrawer inline summary · inline-edit dialog · PaginationBar.
 *
 * Backed by the worksuite `crm_contract_types` collection through
 * `worksuite/contracts-ext.actions.ts`. Multi-tenant via userId.
 */

import * as React from 'react';

import {
  SettingsDeepPage,
  type SettingsColumn,
} from '../../_components/settings-deep-page';
import {
  bulkDeleteContractTypes,
  deleteContractType,
  getContractTypeKpis,
  getContractTypes,
  saveContractType,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractType } from '@/lib/worksuite/contracts-ext-types';

type Row = Omit<WsContractType, '_id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  _id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
};

const columns: SettingsColumn<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    exportValue: (r) => r.name,
  },
];

export default function ContractTypesPage(): React.JSX.Element {
  return (
    <SettingsDeepPage<Row>
      title="Contract Types"
      subtitle="Classification tags for contracts (retainer, project, NDA, etc.)."
      singular="Type"
      drawerKind="Contract Type"
      exportBaseName="contract-types"
      columns={columns}
      fields={[
        {
          name: 'name',
          label: 'Type name',
          required: true,
          fullWidth: true,
          placeholder: 'e.g. Retainer',
        },
      ]}
      getAllAction={getContractTypes as unknown as () => Promise<Row[]>}
      getKpisAction={getContractTypeKpis}
      saveAction={saveContractType}
      deleteAction={deleteContractType}
      bulkDeleteAction={bulkDeleteContractTypes}
      displayName={(r) => r.name ?? '—'}
      searchText={(r) => `${r.name ?? ''}`}
    />
  );
}
