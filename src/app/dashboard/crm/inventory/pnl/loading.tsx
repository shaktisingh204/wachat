import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';
import { LoaderCircle } from 'lucide-react';

export default function PnlLoading() {
    return (
        <EntityListShell
            title="Product-wise P&L"
            subtitle="Per-product profitability over the trailing six months."
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="h-[100px] animate-pulse bg-zoru-surface-2/40" />
                ))}
            </div>

            <Card className="mt-4 h-[350px] animate-pulse bg-zoru-surface-2/40" />

            <Card className="mt-4">
                <div className="flex h-64 items-center justify-center">
                    <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
                </div>
            </Card>
        </EntityListShell>
    );
}
