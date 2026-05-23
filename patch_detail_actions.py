import sys

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustment-detail-actions.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Trash2 } from 'lucide-react';", "import { Trash2, Undo } from 'lucide-react';\nimport { revertStockAdjustment } from '../_actions/revert.actions';\nimport { useRouter } from 'next/navigation';")

content = content.replace("export function AdjustmentDetailActions({ id, status }: AdjustmentDetailActionsProps) {", "export function AdjustmentDetailActions({ id, status }: AdjustmentDetailActionsProps) {\n    const router = useRouter();")

revert_fn = """async function handleRevert() {
        if (!confirm('Are you sure you want to create a reverting adjustment?')) return;
        const res = await revertStockAdjustment(id);
        if (res.success) {
            toast({ title: 'Reverted', description: 'Compensating adjustment created.' });
            if (res.newAdjustmentId) router.push(`/dashboard/crm/inventory/adjustments/${res.newAdjustmentId}`);
        } else {
            toast({ title: 'Revert failed', description: res.error, variant: 'destructive' });
        }
    }"""

content = content.replace("const { toast } = useZoruToast();", "const { toast } = useZoruToast();\n" + revert_fn)

revert_button = """<Button variant="outline" size="sm" onClick={handleRevert} title="Create a compensating adjustment">
                <Undo className="h-3.5 w-3.5" strokeWidth={1.75} />
                Revert
            </Button>"""

content = content.replace("</Button>\n            <ConfirmDialog", "</Button>\n            " + revert_button + "\n            <ConfirmDialog")

with open('src/app/dashboard/crm/inventory/adjustments/_components/adjustment-detail-actions.tsx', 'w') as f:
    f.write(content)

