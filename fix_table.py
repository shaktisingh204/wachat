import sys

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustments-table.tsx', 'r') as f:
    content = f.read()

content = content.replace("import type { WithId } from 'mongodb';", "import type { WithId } from 'mongodb';\nimport { StockAdjustment } from '../types';")
content = content.replace("function impactOf(adj: WithId<CrmStockAdjustment>): number {", "function impactOf(adj: StockAdjustment): number {")
content = content.replace("(adj as any).costPerUnit", "adj.costPerUnit")
content = content.replace("rows: WithId<CrmStockAdjustment>[];", "rows: StockAdjustment[];")
content = content.replace("a: WithId<CrmStockAdjustment>;", "a: StockAdjustment;")
content = content.replace("(a as any).status", "a.status")
content = content.replace("(a as any).lines?.length", "a.lines?.length")
content = content.replace("(a as any).adjustmentNumber", "a.adjustmentNumber")
content = content.replace("(a as any).warehouseName", "a.warehouseName")
content = content.replace("(a as any).approvedBy", "a.approvedBy")
content = content.replace("(a as any).approvedByName", "a.approvedByName")

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustments-table.tsx', 'w') as f:
    f.write(content)

