import { Suspense } from 'react';
import { Layers } from 'lucide-react';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { NewCustomFieldForm } from './new-field-form';

/** Custom field create / edit page. Accepts ?group=ID and optional ?id=ID. */
export default function NewCustomFieldPage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CrmPageHeader
        title="Custom Field"
        subtitle="Add a custom field to a group. Values are stored against the target record."
        icon={Layers}
      />
      <Suspense
        fallback={
          <div className="text-[13px] text-clay-ink-muted">Loading…</div>
        }
      >
        <NewCustomFieldForm />
      </Suspense>
    </div>
  );
}
