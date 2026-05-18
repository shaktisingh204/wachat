'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { UserCog } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadAgents,
  saveLeadAgent,
  deleteLeadAgent,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadAgent } from '@/lib/worksuite/crm-types';

export default function LeadAgentsPage() {
  return (
    <HrEntityPage<WsLeadAgent & { _id: string }>
      title="Lead Agents"
      subtitle="Employees assigned to specific leads as the primary sales contact."
      icon={UserCog}
      singular="Assignment"
      getAllAction={getLeadAgents as any}
      saveAction={saveLeadAgent}
      deleteAction={deleteLeadAgent}
      columns={[
        { key: 'lead_id', label: 'Lead' },
        { key: 'user_id', label: 'Agent' },
      ]}
      fields={[
        {
          name: 'lead_id',
          label: 'Lead',
          required: true,
          type: 'entity',
          entity: 'lead',
          allowCreate: true,
          placeholder: 'Select or create a lead…',
        },
        {
          name: 'user_id',
          label: 'Agent',
          required: true,
          type: 'entity',
          entity: 'employee',
          allowCreate: true,
          placeholder: 'Select or create an employee…',
        },
      ]}
    />
  );
}
