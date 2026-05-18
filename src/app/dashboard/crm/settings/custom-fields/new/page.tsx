import { Suspense } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { NewCustomFieldForm } from './new-field-form';

/** Custom field create / edit page. Accepts ?group=ID and optional ?id=ID. */
export default function NewCustomFieldPage() {
  return (
    <EntityListShell
      title="Custom Field"
      subtitle="Add a custom field to a group. Values are stored against the target record."
    >
      <Suspense
        fallback={
          <div className="text-[13px] text-zoru-ink-muted">Loading…</div>
        }
      >
        <NewCustomFieldForm />
      </Suspense>
    </EntityListShell>
  );
}
