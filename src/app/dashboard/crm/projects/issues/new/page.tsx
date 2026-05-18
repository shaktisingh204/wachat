import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { NewIssueForm } from './new-issue-form';

/** Create a new standalone issue. */
export default function NewIssuePage() {
  return (
    <EntityDetailShell
      eyebrow="ISSUE"
      title="New Issue"
      back={{ href: '/dashboard/crm/projects/issues', label: 'Issues' }}
    >
      <NewIssueForm />
    </EntityDetailShell>
  );
}
