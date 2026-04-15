'use client';

import { UserCog } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getEmployeeSkills,
  saveEmployeeSkill,
  deleteEmployeeSkill,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsEmployeeSkill } from '@/lib/worksuite/hr-ext-types';

export default function EmployeeSkillsPage() {
  return (
    <HrEntityPage<WsEmployeeSkill & { _id: string }>
      title="Employee Skills"
      subtitle="Assign skills from the master list to employees."
      icon={UserCog}
      singular="Assignment"
      getAllAction={getEmployeeSkills as any}
      saveAction={saveEmployeeSkill}
      deleteAction={deleteEmployeeSkill}
      columns={[
        { key: 'user_id', label: 'Employee' },
        { key: 'skill_id', label: 'Skill' },
      ]}
      fields={[
        { name: 'user_id', label: 'Employee ID', required: true },
        { name: 'skill_id', label: 'Skill ID', required: true },
      ]}
    />
  );
}
