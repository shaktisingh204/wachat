'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { bulkCreatePosts } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, FileUp, Plus, Trash2, Send, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PostRow = { message: string; imageUrl: string; scheduledTime: string };

export default function BulkCreatePage() {
    const { toast } = useToast();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [rows, setRows] = useState<PostRow[]>([{ message: '', imageUrl: '', scheduledTime: '' }]);
    const [isPublishing, startPublish] = useTransition();
    const [result, setResult] = useState<{ successCount: number; failCount: number } | null>(null);

    useEffect(() => {
        setProjectId(localStorage.getItem('activeProjectId'));
    }, []);

    const addRow = () => setRows(prev => [...prev, { message: '', imageUrl: '', scheduledTime: '' }]);
    const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, field: keyof PostRow, value: string) => {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast({ title: 'Empty CSV' }); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const msgIdx = headers.findIndex(h => h === 'message' || h === 'text' || h === 'content');
            const imgIdx = headers.findIndex(h => h === 'image_url' || h === 'imageurl' || h === 'image');
            const timeIdx = headers.findIndex(h => h === 'scheduled_time' || h === 'scheduledtime' || h === 'schedule');

            if (msgIdx === -1) { toast({ title: 'CSV must have a "message" column', variant: 'destructive' }); return; }

            const parsed: PostRow[] = [];
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const msg = vals[msgIdx] || '';
                if (!msg) continue;
                parsed.push({
                    message: msg,
                    imageUrl: imgIdx >= 0 ? (vals[imgIdx] || '') : '',
                    scheduledTime: timeIdx >= 0 ? (vals[timeIdx] || '') : '',
                });
            }
            if (parsed.length > 0) {
                setRows(parsed);
                toast({ title: `Parsed ${parsed.length} posts from CSV` });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handlePublish = () => {
        if (!projectId) return;
        const validPosts = rows.filter(r => r.message.trim());
        if (validPosts.length === 0) { toast({ title: 'No posts to publish', variant: 'destructive' }); return; }

        startPublish(async () => {
            const res = await bulkCreatePosts(projectId, validPosts.map(p => ({
                message: p.message,
                imageUrl: p.imageUrl || undefined,
                scheduledTime: p.scheduledTime || undefined,
            })));
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                setResult({ successCount: res.successCount, failCount: res.failCount });
                toast({ title: `Published ${res.successCount} posts, ${res.failCount} failed` });
            }
        });
    };

    const validCount = rows.filter(r => r.message.trim()).length;

    if (!projectId) {
        return (
            <div className="flex flex-col gap-8">
                <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No Project Selected</AlertTitle><AlertDescription>Select a project from the sidebar.</AlertDescription></Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><FileUp /> Bulk Post Creator</h1>
                <p className="text-muted-foreground">Create multiple posts at once. Enter manually or upload a CSV file.</p>
            </div>

            {result && (
                <Alert>
                    <Send className="h-4 w-4" />
                    <AlertTitle>Bulk Publish Complete</AlertTitle>
                    <AlertDescription>{result.successCount} succeeded, {result.failCount} failed.</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="manual">
                <TabsList>
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="csv" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Upload CSV</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">CSV must have a <code>message</code> column. Optional columns: <code>image_url</code>, <code>scheduled_time</code>.</p>
                            <Input type="file" accept=".csv" onChange={handleCsvUpload} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add Row</Button>
                    </div>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Posts Preview <Badge variant="secondary" className="ml-2">{validCount} posts</Badge></span>
                        <Button
                            className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                            onClick={handlePublish}
                            disabled={isPublishing || validCount === 0}
                        >
                            <Send className="h-4 w-4 mr-1" /> {isPublishing ? 'Publishing...' : `Publish ${validCount} Posts`}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Image URL</TableHead>
                                <TableHead>Schedule</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                    <TableCell>
                                        <Input
                                            value={row.message}
                                            onChange={e => updateRow(i, 'message', e.target.value)}
                                            placeholder="Post message..."
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={row.imageUrl}
                                            onChange={e => updateRow(i, 'imageUrl', e.target.value)}
                                            placeholder="https://..."
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="datetime-local"
                                            value={row.scheduledTime}
                                            onChange={e => updateRow(i, 'scheduledTime', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => removeRow(i)} disabled={rows.length <= 1}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
