const fs = require('fs');
const file = 'src/app/dashboard/crm/reports/gstr-1/_components/gstr1-client.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('syncWithGstPortal')) {
    content = content.replace(
        "import { downloadGstr1Json } from '@/app/actions/crm-india-gst.actions';",
        "import { downloadGstr1Json, syncWithGstPortal } from '@/app/actions/crm-india-gst.actions';"
    );
}

if (!content.includes('isSyncing')) {
    content = content.replace(
        "const [isExportingJson, setIsExportingJson] = React.useState(false);",
        "const [isExportingJson, setIsExportingJson] = React.useState(false);\n    const [isSyncing, setIsSyncing] = React.useState(false);\n\n    const handleSync = async () => {\n        setIsSyncing(true);\n        try {\n            const res = await syncWithGstPortal({ month, year }, 'GSTR1');\n            toast({ description: res.message });\n        } catch (e) {\n            toast({ variant: 'destructive', description: 'Failed to sync with GST portal.' });\n        } finally {\n            setIsSyncing(false);\n        }\n    };"
    );
}

const oldButtons = `
            <div className="flex justify-end">
                <DropdownMenu>
`;
const newButtons = `
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? 'Syncing...' : 'Sync Portal'}
                </Button>
                <DropdownMenu>
`;
if (!content.includes('Sync Portal')) {
    content = content.replace(oldButtons.trim(), newButtons.trim());
}

fs.writeFileSync(file, content);
