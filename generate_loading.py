import os
import re

modules = [
    ('bank-reconciliation', 'Bank Reconciliation'),
    ('payouts', 'Direct Payouts'),
    ('po-approvals', 'PO Approvals'),
    ('subscriptions', 'Subscriptions Billing'),
    ('taxes', 'Tax Filing'),
    ('vendor-portal', 'Vendor Portal')
]

for dir_name, title in modules:
    content = f"""import {{ EntityListShell }} from '@/components/crm/entity-list-shell';

export default function Loading() {{
  return (
    <EntityListShell
      title="{title}"
      loading={{true}}
    >
      <div />
    </EntityListShell>
  );
}}
"""
    file_path = f"src/app/dashboard/finance/{dir_name}/loading.tsx"
    with open(file_path, 'w') as f:
        f.write(content)

