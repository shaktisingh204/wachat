const fs = require('fs');
const file = 'src/app/dashboard/crm/reports/gstr-2b/_components/gstr2b-client.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('syncWithGstPortal')) {
    content = content.replace(
        "import { EntityRowLink } from '@/components/crm/entity-row-link';",
        "import { EntityRowLink } from '@/components/crm/entity-row-link';\nimport { syncWithGstPortal, reconcileGstr2bVsLocal } from '@/app/actions/crm-india-gst.actions';\nimport { useZoruToast } from '@/components/zoruui';"
    );
}

if (!content.includes('isSyncing')) {
    content = content.replace(
        "export function Gstr2bClient({",
        "export function Gstr2bClient({\n"
    );
    
    const hookInsertion = `
    const { toast } = useZoruToast();
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isReconciling, setIsReconciling] = React.useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncWithGstPortal({ month, year }, 'GSTR2B');
            toast({ description: res.message });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Failed to sync with GST portal.' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleReconcile = async () => {
        setIsReconciling(true);
        try {
            const res = await reconcileGstr2bVsLocal({ month, year });
            toast({ description: \`Reconciliation complete: \${res.totalMatched} matched, \${res.discrepancies} discrepancies.\` });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Failed to run reconciliation.' });
        } finally {
            setIsReconciling(false);
        }
    };
`;
    content = content.replace(
        "    gstr2bJsonFilename,\n}: Gstr2bClientProps) {",
        "    gstr2bJsonFilename,\n}: Gstr2bClientProps) {" + hookInsertion
    );
}

const oldButtons = `
            <div className="flex justify-end">
                <DropdownMenu>
`;
const newButtons = `
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleReconcile} disabled={isReconciling}>
                    {isReconciling ? 'Running...' : 'Reconcile'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? 'Syncing...' : 'Sync Portal'}
                </Button>
                <DropdownMenu>
`;
if (!content.includes('Sync Portal')) {
    content = content.replace(oldButtons.trim(), newButtons.trim());
}

fs.writeFileSync(file, content);
