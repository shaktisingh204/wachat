import sys

with open('src/app/dashboard/crm/inventory/adjustments/[id]/activity/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';", "import { FilteredAuditTimeline } from '../../_components/filtered-audit-timeline';\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';\nimport { redirect } from 'next/navigation';\nimport { mapToStockAdjustmentDto } from '../../types';")
content = content.replace("interface PageProps {\n  params: Promise<{ id: string }>;\n}", "interface PageProps {\n  params: Promise<{ id: string }>;\n  searchParams: Promise<{ eventType?: string }>;\n}")
content = content.replace("export default async function StockAdjustmentActivityPage({ params }: PageProps) {", "export default async function StockAdjustmentActivityPage({ params, searchParams }: PageProps) {\n  const resolvedParams = await params;\n  const resolvedSearch = await searchParams;\n  const { eventType } = resolvedSearch;")
content = content.replace("const { id } = await params;", "const { id } = resolvedParams;")
content = content.replace("const adj = await getCrmStockAdjustmentById(id);", "const rawAdj = await getCrmStockAdjustmentById(id);\n  const adj = mapToStockAdjustmentDto(rawAdj);")
content = content.replace("if (!adj) notFound();", "if (!rawAdj) notFound();")
content = content.replace("(adj as any).productName", "adj.productName")
content = content.replace("<EntityAuditTimeline entityKind=\"stock_adjustment\" entityId={id} />", """<div className="mb-4 flex items-center justify-end">
        <form className="flex items-center gap-2">
          <label htmlFor="eventType" className="text-sm text-zinc-500">Filter by event:</label>
          <select 
            id="eventType" 
            name="eventType" 
            className="rounded-md border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
            defaultValue={eventType || ''}
          >
            <option value="">All events</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="status_change">Status Changed</option>
          </select>
          <button type="submit" className="rounded bg-zinc-100 px-3 py-1 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">Filter</button>
        </form>
      </div>
      <FilteredAuditTimeline entityKind="stock_adjustment" entityId={id} eventType={eventType} />""")

with open('src/app/dashboard/crm/inventory/adjustments/[id]/activity/page.tsx', 'w') as f:
    f.write(content)

