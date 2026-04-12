'use client';

import * as React from 'react';
import { Target, Plus, Copy, AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listPixels, createPixel } from '@/app/actions/ad-manager.actions';

export default function PixelsPage() {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [name, setName] = React.useState('');
    const [open, setOpen] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const res = await listPixels(activeAccount.account_id);
        setPixels(res.data || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!activeAccount || !name.trim()) return;
        const res = await createPixel(activeAccount.account_id, name.trim());
        if (res.error) {
            toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Pixel created' });
        setOpen(false);
        setName('');
        load();
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view pixels.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Target className="h-6 w-6" /> Pixels & datasets
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Track conversions, optimize delivery and build audiences from your website.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={load}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90">
                                <Plus className="h-4 w-4 mr-1" /> Create pixel
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Meta Pixel</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2">
                                <Label>Pixel name</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreate}>Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                </div>
            ) : pixels.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center space-y-3">
                        <Target className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="font-medium">No pixels yet</p>
                        <p className="text-sm text-muted-foreground">Create your first pixel to start tracking.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 gap-3">
                    {pixels.map((p) => (
                        <Card key={p.id}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                    {p.name}
                                    {p.last_fired_time && (
                                        <Badge variant="outline" className="text-green-600">Active</Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-mono bg-muted px-2 py-1.5 rounded">
                                    <span className="truncate flex-1">{p.id}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={() => {
                                            navigator.clipboard.writeText(p.id);
                                            toast({ title: 'Copied' });
                                        }}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                                {p.last_fired_time && (
                                    <div className="text-xs text-muted-foreground">
                                        Last event: {new Date(p.last_fired_time).toLocaleString()}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
