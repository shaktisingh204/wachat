import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
  return (
    <EntityListShell
      title="Bank Transactions"
      subtitle="Extended ledger — deposits, withdrawals, transfers. Auto-populated by payments and refunds."
      loading={true}
    >
      <div />
    </EntityListShell>
  );
}
