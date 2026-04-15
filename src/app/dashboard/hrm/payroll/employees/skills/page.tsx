'use client';

import { Sparkles } from 'lucide-react';
import { HrEntityPage } from '../../../hr/_components/hr-entity-page';
import {
  getSkills,
  saveSkill,
  deleteSkill,
} from '@/app/actions/worksuite/hr-ext.actions';
import type { WsSkill } from '@/lib/worksuite/hr-ext-types';

export default function SkillsMasterPage() {
  return (
    <HrEntityPage<WsSkill & { _id: string }>
      title="Skills"
      subtitle="Master list of skills used across the organisation."
      icon={Sparkles}
      singular="Skill"
      getAllAction={getSkills as any}
      saveAction={saveSkill}
      deleteAction={deleteSkill}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ name: 'name', label: 'Skill Name', required: true, fullWidth: true }]}
    />
  );
}
