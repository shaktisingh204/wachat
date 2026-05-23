import sys

with open('src/app/dashboard/crm/inventory/adjustments/[id]/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { AdjustmentDetailActions } from '../_components/adjustment-detail-actions';", "import { AdjustmentDetailActions } from '../_components/adjustment-detail-actions';\nimport { PrintButton } from '../_components/print-button';\nimport { mapToStockAdjustmentDto } from '../types';")
content = content.replace("const adj = await getCrmStockAdjustmentById(id);", "const rawAdj = await getCrmStockAdjustmentById(id);\n    const adj = mapToStockAdjustmentDto(rawAdj);")
content = content.replace("if (!adj) notFound();", "if (!rawAdj) notFound();")
content = content.replace("(adj as any).", "adj.")
content = content.replace("adj.lines as\n        | Array<{\n              productId: string;\n              qtyBefore?: number;\n              qtyAfter?: number;\n              delta?: number;\n              batch?: string;\n              serial?: string;\n              costPerUnit?: number;\n          }>\n        | undefined", "adj.lines")
content = content.replace("String(adj._id)", "String(adj._id)")
content = content.replace("""<Button variant="outline" size="sm" asChild>
                        <a href="javascript:window.print()">
                            <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Print
                        </a>
                    </Button>""", "<PrintButton />")

with open('src/app/dashboard/crm/inventory/adjustments/[id]/page.tsx', 'w') as f:
    f.write(content)

