import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/zoruui';
import { LoaderCircle } from 'lucide-react';

export default function PartyTransactionsLoading() {
    return (
        <EntityListShell
            title="Party transactions"
            subtitle="Inventory + receivable exposure for every customer and vendor."
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="h-[104px] animate-pulse bg-muted/20" />
                ))}
            </div>
            <Card className="mt-4 h-[352px] animate-pulse bg-muted/20 flex items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </Card>
            <Card className="mt-4 h-[400px] animate-pulse bg-muted/20" />
        </EntityListShell>
    );
}
