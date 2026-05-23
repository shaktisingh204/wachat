import sys

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustments-list-client.tsx', 'r') as f:
    content = f.read()

content = content.replace("import type { WithId } from 'mongodb';", "import type { WithId } from 'mongodb';\nimport { mapToStockAdjustmentDto, StockAdjustment } from '../types';")
content = content.replace("const [rows, setRows] = React.useState<WithId<CrmStockAdjustment>[]>([]);", "const [rows, setRows] = React.useState<StockAdjustment[]>([]);")
content = content.replace("setRows(adjustments);", "setRows(adjustments.map(mapToStockAdjustmentDto));")
content = content.replace("function impactOf(adj: WithId<CrmStockAdjustment>): number {", "function impactOf(adj: StockAdjustment): number {")
content = content.replace("(adj as any).costPerUnit", "adj.costPerUnit")
content = content.replace("(r as any).adjustmentNumber", "r.adjustmentNumber")
content = content.replace("(r as any).warehouseName", "r.warehouseName")
content = content.replace("(r as any).lines?.length", "r.lines?.length")
content = content.replace("(r as any).status", "r.status")
content = content.replace("(r as any).approvedByName", "r.approvedByName")
content = content.replace("(deleteTarget as any)?.adjustmentNumber", "deleteTarget?.adjustmentNumber")

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustments-list-client.tsx', 'w') as f:
    f.write(content)

