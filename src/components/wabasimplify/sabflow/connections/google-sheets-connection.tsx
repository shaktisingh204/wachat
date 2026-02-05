'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getSabFlowConnections, saveSabFlowConnection } from '@/app/actions/sabflow.actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { LoaderCircle, Plus, Check, ChevronRight, AlertCircle, FileSpreadsheet } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';

export function GoogleSheetsConnection({ flowId, onConnectionSaved }: { flowId?: string, onConnectionSaved?: () => void }) {
    const { toast } = useToast();
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
    const [view, setView] = useState<'select' | 'create'>('select');

    // Create Form State
    const [isCreating, startCreation] = useTransition();

    // Fetch connections on mount
    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const data = await getSabFlowConnections('google_sheets');
            setConnections(data);
            if (data.length > 0 && !selectedConnectionId) {
                // Auto select first? Maybe no, let user choose.
                setView('select');
            } else if (data.length === 0) {
                setView('create');
            }
        } catch (e) {
            console.error("Failed to load connections", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateConnection = (formData: FormData) => {
        startCreation(async () => {
            // Append static app data
            formData.append('appId', 'google_sheets');
            formData.append('appName', 'Google Sheets');
            // We use credentialKeys logic in backend, but for sheets it's custom.
            // Let's manually reconstruct the credentials object in the backend or hack it here?
            // Actually saveSabFlowConnection expects 'credentialKeys' to know what to pick from formData.
            formData.append('credentialKeys', 'spreadsheetId,sheetName');

            const result = await saveSabFlowConnection(null, formData);
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "Connected!", description: "Project connected successfully." });
                await loadConnections();
                setView('select');
                if (onConnectionSaved) onConnectionSaved();
            }
        });
    };

    const webhookUrl = flowId ? `${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}` : 'Save flow to generate URL';

    if (loading) {
        return <div className="flex justify-center p-8"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6 text-sm">
            <style>{`
                .instruction-list > li { margin-bottom: 0.75rem; }
            `}</style>

            {/* View Switching Logic */}
            {view === 'select' && connections.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                    <div className="space-y-2">
                        <Label>Select Connected Project</Label>
                        <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project..." />
                            </SelectTrigger>
                            <SelectContent>
                                {connections.map(c => (
                                    <SelectItem key={c._id} value={c._id}>
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                            <span>{c.connectionName}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setView('create')}>
                            <Plus className="mr-2 h-3 w-3" /> Connect New Sheet
                        </Button>
                    </div>

                    {/* Show instructions only if a connection is selected, or maybe always? 
                       Let's show always but emphasize the selected one details eventually.
                   */}
                    {selectedConnectionId && (
                        <div className="p-3 bg-green-50 text-green-800 rounded-md text-xs border border-green-200 mt-2 flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Using connection: <strong>{connections.find(c => c._id === selectedConnectionId)?.connectionName}</strong>
                        </div>
                    )}
                </div>
            )}

            {view === 'create' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            Connect New Sheet
                        </h4>
                        {connections.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setView('select')}>Cancel</Button>
                        )}
                    </div>

                    <form action={handleCreateConnection} className="space-y-4 border p-4 rounded-lg bg-card/50">
                        <div className="space-y-2">
                            <Label htmlFor="connectionName">Project Name</Label>
                            <Input id="connectionName" name="connectionName" placeholder="e.g. Sales Leads Sheet" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
                            <Input id="spreadsheetId" name="spreadsheetId" placeholder="The long ID from your sheet URL" required />
                            <p className="text-[10px] text-muted-foreground">Found in the URL: docs.google.com/spreadsheets/d/<strong>spreadsheet-id</strong>/edit</p>
                        </div>
                        <Button type="submit" className="w-full" disabled={isCreating}>
                            {isCreating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Connect Sheet
                        </Button>
                    </form>
                </div>
            )}

            <Separator />

            {/* Setup Instructions - Make it collapsible but open by default if no connection selected? */}
            <Accordion type="single" collapsible defaultValue="instructions" className="w-full">
                <AccordionItem value="instructions" className="border-b-0">
                    <AccordionTrigger className="font-semibold text-sm hover:no-underline py-2">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            Setup Instructions & Webhook
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Step 1: Copy Webhook URL</Label>
                                <div style={{ overflow: 'scroll' }}>
                                    <CodeBlock wrap code={webhookUrl} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Step 2: Install Add-on</Label>
                                <ol className="list-decimal list-inside space-y-2 instruction-list text-muted-foreground text-xs">
                                    <li>Create/Open your Google Sheet.</li>
                                    <li>Go to <code className="bg-muted px-1 rounded-sm">Extensions &gt; Add-ons &gt; Get add-ons</code>.</li>
                                    <li>Install <strong>"SabFlow Webhooks"</strong> add-on.</li>
                                </ol>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Step 3: Configure</Label>
                                <ol className="list-decimal list-inside space-y-2 instruction-list text-muted-foreground text-xs">
                                    <li>Go to <code className="bg-muted px-1 rounded-sm">Extensions &gt; SabFlow Webhooks &gt; Initial Setup</code>.</li>
                                    <li>Paste the <strong>Webhook URL</strong> from above.</li>
                                    <li>Click "Send Test" then "Submit".</li>
                                    <li><strong>Important:</strong> Enable "Send on Edit" trigger in the add-on menu.</li>
                                </ol>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
