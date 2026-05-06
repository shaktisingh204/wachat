'use client';

import { Ruler } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getUnitTypes,
  saveUnitType,
  deleteUnitType,
} from '@/app/actions/worksuite/meta.actions';
import type { WsUnitType } from '@/lib/worksuite/meta-types';

/** Unit types (e.g. Kg, Box, Piece) used by inventory and invoicing. */
export default function UnitTypesPage() {
  return (
    <HrEntityPage<WsUnitType & { _id: string }>
      title="Unit Types"
      subtitle="Measurement units used when issuing invoices, orders, and stock entries."
      icon={Ruler}
      singular="Unit"
      getAllAction={getUnitTypes as any}
      saveAction={saveUnitType}
      deleteAction={deleteUnitType}
      columns={[
        { key: 'unit_name', label: 'Name' },
        { key: 'short_name', label: 'Short' },
      ]}
      fields={[
        { name: 'unit_name', label: 'Unit name', required: true, placeholder: 'Kilogram' },
        { name: 'short_name', label: 'Short name', placeholder: 'Kg' },
      ]}
    />
  );
}
