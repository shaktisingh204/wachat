import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card } from '@/components/sabcrm/20ui';

export default function LoadingFixedAssetEdit() {
    return (
        <EntityDetailShell
            eyebrow="FIXED ASSET"
            title="Edit · Loading..."
            back={{ href: '/dashboard/crm/fixed-assets', label: 'Fixed Assets' }}
        >
            <div className="space-y-6 animate-pulse">
                <Card className="h-[250px] w-full bg-[var(--st-bg-muted)]/20" />
                <Card className="h-[250px] w-full bg-[var(--st-bg-muted)]/20" />
                <Card className="h-[250px] w-full bg-[var(--st-bg-muted)]/20" />
            </div>
        </EntityDetailShell>
    );
}
