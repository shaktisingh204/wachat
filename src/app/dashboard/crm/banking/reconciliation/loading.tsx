import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function BankReconciliationLoading() {
  return <EntityListShell loading={true} title="Bank Reconciliation" subtitle="Match your bank statement transactions with your company's book entries." />;
}
