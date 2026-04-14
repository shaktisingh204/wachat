'use client';

import { Users2 } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getEmployeeTeams,
  saveEmployeeTeam,
  deleteEmployeeTeam,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsEmployeeTeam } from '@/lib/worksuite/hr-ext-types';

export default function EmployeeTeamsPage() {
  return (
    <HrEntityPage<WsEmployeeTeam & { _id: string }>
      title="Employee Teams"
      subtitle="Define employee teams with designated leaders."
      icon={Users2}
      singular="Team"
      getAllAction={getEmployeeTeams as any}
      saveAction={saveEmployeeTeam}
      deleteAction={deleteEmployeeTeam}
      columns={[
        { key: 'team_name', label: 'Team' },
        { key: 'leader_user_id', label: 'Leader' },
      ]}
      fields={[
        { name: 'team_name', label: 'Team Name', required: true, fullWidth: true },
        { name: 'leader_user_id', label: 'Leader Employee ID' },
      ]}
    />
  );
}
