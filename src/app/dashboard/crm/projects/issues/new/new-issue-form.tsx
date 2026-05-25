'use client';

import { IssueForm } from '../_components/issue-form';

/** Create a new standalone issue using the shared `<IssueForm>` component. */
export function NewIssueForm() {
  return <IssueForm mode="new" />;
}
