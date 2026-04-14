import { Bug } from 'lucide-react';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { NewIssueForm } from './new-issue-form';

/** Create a new standalone issue. */
export default function NewIssuePage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CrmPageHeader
        title="New Issue"
        subtitle="Log a new bug, blocker, or incident."
        icon={Bug}
      />
      <NewIssueForm />
    </div>
  );
}
