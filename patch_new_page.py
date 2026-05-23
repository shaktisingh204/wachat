import sys

with open('src/app/dashboard/crm/inventory/adjustments/new/adjustment-form.tsx', 'r') as f:
    content = f.read()

content = content.replace("export function AdjustmentForm() {", "export default function NewStockAdjustmentPage() {")

with open('src/app/dashboard/crm/inventory/adjustments/new/page.tsx', 'w') as f:
    f.write(content)

