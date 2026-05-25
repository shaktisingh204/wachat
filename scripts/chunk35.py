import os
import re

files_list = [
    "src/app/p/proposal/[token]/page.tsx",
    "src/app/p/thanks/page.tsx",
    "src/app/p/ticket-form/[formId]/page.tsx",
    "src/app/page.tsx",
    "src/app/partners/page.tsx",
    "src/app/pending-approval/page.tsx",
    "src/app/portal/[tenantSlug]/login/page.tsx",
    "src/app/portal/[tenantSlug]/login/success/page.tsx",
    "src/app/portal/[tenantSlug]/page.tsx",
    "src/app/portal/client/contracts/page.tsx",
    "src/app/portal/client/estimates/page.tsx",
    "src/app/portal/client/invoices/[id]/page.tsx",
    "src/app/portal/client/invoices/page.tsx",
    "src/app/portal/client/knowledge-base/[id]/page.tsx",
    "src/app/portal/client/knowledge-base/page.tsx",
    "src/app/portal/client/page.tsx",
    "src/app/portal/client/profile/page.tsx",
    "src/app/portal/client/projects/[id]/page.tsx",
    "src/app/portal/client/projects/page.tsx",
    "src/app/portal/client/tickets/[id]/page.tsx",
    "src/app/portal/client/tickets/page.tsx",
    "src/app/portfolio/[slug]/[pageSlug]/page.tsx",
    "src/app/portfolio/[slug]/page.tsx",
    "src/app/pricing/page.tsx",
    "src/app/privacy-policy/page.tsx",
    "src/app/products/page.tsx",
    "src/app/r/[shortCode]/page.tsx",
    "src/app/resources/page.tsx",
    "src/app/s/[shortCode]/page.tsx",
    "src/app/sabsms/[...slug]/page.tsx",
    "src/app/sabsms/ab-tests/page.tsx",
    "src/app/sabsms/analytics/cohorts/page.tsx",
    "src/app/sabsms/analytics/cost/page.tsx",
    "src/app/sabsms/analytics/deliverability/page.tsx",
    "src/app/sabsms/analytics/funnel/page.tsx",
    "src/app/sabsms/analytics/numbers/page.tsx",
    "src/app/sabsms/analytics/page.tsx",
    "src/app/sabsms/api-docs/page.tsx",
    "src/app/sabsms/api-keys/page.tsx",
    "src/app/sabsms/campaigns/[id]/page.tsx",
    "src/app/sabsms/campaigns/create/page.tsx",
    "src/app/sabsms/campaigns/new/page.tsx",
    "src/app/sabsms/campaigns/page.tsx",
    "src/app/sabsms/compliance/10dlc/page.tsx",
    "src/app/sabsms/compliance/audit/page.tsx"
]

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

for rel_path in files_list:
    abs_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(abs_path):
        print(f"File not found: {abs_path}")
        continue
    with open(abs_path, 'r') as f:
        content = f.read()

    print(f"\n--- {rel_path} ---")
    lines = content.split('\n')
    print('\n'.join(lines[:20]))

