import sys

with open('src/app/dashboard/crm/inventory/adjustments/[id]/edit/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';", "import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';\nimport { mapToStockAdjustmentDto } from '../../types';")

replace_target = """    const initial = JSON.parse(JSON.stringify(adj)) as {
        _id: string;
        reason: string;
        notes?: string;
        quantity: number;
        productName?: string;
        warehouseName?: string;
        referenceNumber?: string;
        adjustmentNumber?: string;
    };"""

replacement = """    const initial = mapToStockAdjustmentDto(adj) as any;"""

content = content.replace(replace_target, replacement)

with open('src/app/dashboard/crm/inventory/adjustments/[id]/edit/page.tsx', 'w') as f:
    f.write(content)

