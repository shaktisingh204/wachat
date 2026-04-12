'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    Users, Plus, AlertCircle, Search, Trash2, MoreHorizontal,
    UserPlus, Globe, Sparkles, RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
    DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import {
    getCustomAudiences, getSavedAudiences, createCustomAudience,
    createLookalikeAudience, deleteCustomAudience,
} from '@/app/actions/ad-manager.actions';
import { COUNTRIES, formatNumber } from '@/components/wabasimplify/ad-manager/constants';
import type { CustomAudience } from '@/lib/definitions';

function CreateAudienceDialog({ onCreated }: { onCreated: () => void }) {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const [open, setOpen] = React.useState(false);
    const [type, setType] = React.useState<'custom' | 'lookalike'>('custom');
    const [submitting, setSubmitting] = React.useState(false);

    const [customName, setCustomName] = React.useState('');
    const [customDesc, setCustomDesc] = React.useState('');
    const [customSubtype, setCustomSubtype] = React.useState<'WEBSITE' | 'ENGAGEMENT' | 'CUSTOM'>('WEBSITE');

    const [lookName, setLookName] = React.useState('');
    const [lookOrigin, setLookOrigin] = React.useState('');
    const [lookCountry, setLookCountry] = React.useState('IN');
    const [lookRatio, setLookRatio] = React.useState('0.01');

    const submit = async () => {
        if (!activeAccount) return;
        setSubmitting(true);
        let res;
        if (type === 'custom') {
            res = await createCustomAudience(activeAccount.account_id, {
                name: customName,
                description: customDesc,
                subtype: customSubtype,
            });
        } else {
            res = await createLookalikeAudience(activeAccount.account_id, {
                name: lookName,
                origin_audience_id: lookOrigin,
                country: lookCountry,
                ratio: Number(lookRatio),
            });
        }
        setSubmitting(false);
        if (res.error) {
            toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Audience created' });
        setOpen(false);
        onCreated();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Create audience
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create audience</DialogTitle>
                    <DialogDescription>Build a custom or lookalike audience.</DialogDescription>
                </DialogHeader>
                <Tabs value={type} onValueChange={(v) => setType(v as any)}>
                    <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="custom">Custom audience</TabsTrigger>
                        <TabsTrigger value="lookalike">Lookalike</TabsTrigger>
                    </TabsList>
                    <TabsContent value="custom" className="pt-4 space-y-3">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Textarea value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Source</Label>
                            <Select value={customSubtype} onValueChange={(v) => setCustomSubtype(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WEBSITE">Website (Pixel)</SelectItem>
                                    <SelectItem value="ENGAGEMENT">Engagement</SelectItem>
                                    <SelectItem value="CUSTOM">Customer list</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>
                    <TabsContent value="lookalike" className="pt-4 space-y-3">
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={lookName} onChange={(e) => setLookName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Source audience ID</Label>
                            <Input value={lookOrigin} onChange={(e) => setLookOrigin(e.target.value)} placeholder="Custom audience ID" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Country</Label>
                                <Select value={lookCountry} onValueChange={setLookCountry}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {COUNTRIES.map((c) => (
                                            <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Similarity ratio</Label>
                                <Select value={lookRatio} onValueChange={setLookRatio}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.01">1% – most similar</SelectItem>
                                        <SelectItem value="0.03">3%</SelectItem>
                                        <SelectItem value="0.05">5%</SelectItem>
                                        <SelectItem value="0.10">10% – broadest</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={submit} disabled={submitting} className="bg-[#1877F2] hover:bg-[#1877F2]/90">
                        {submitting ? 'Creating…' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AudiencesPage() {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const [loading, setLoading] = React.useState(true);
    const [audiences, setAudiences] = React.useState<CustomAudience[]>([]);
    const [saved, setSaved] = React.useState<any[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');

    const load = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const [a, s] = await Promise.all([
            getCustomAudiences(activeAccount.account_id),
            getSavedAudiences(activeAccount.account_id),
        ]);
        if (a.error) setError(a.error);
        setAudiences(a.audiences || []);
        setSaved(s.data || []);
        setLoading(false);
    }, [activeAccount]);

    React.useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string) => {
        const res = await deleteCustomAudience(id);
        if (res.error) toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        else {
            toast({ title: 'Audience deleted' });
            setAudiences((a) => a.filter((x) => x.id !== id));
        }
    };

    const filteredCustom = audiences.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

    if (!activeAccount) {
        return (
            <div className="p-8 text-center space-y-4">
                <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                <Alert className="max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view audiences.</AlertDescription>
                </Alert>
                <Button asChild><Link href="/dashboard/ad-manager/ad-accounts">Go to Ad accounts</Link></Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-6 w-6" /> Audiences
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage custom, lookalike and saved audiences.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={load}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <CreateAudienceDialog onCreated={load} />
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
                {[
                    { icon: UserPlus, label: 'Custom audiences', value: audiences.length, color: 'text-[#1877F2]' },
                    { icon: Sparkles, label: 'Lookalike audiences', value: audiences.filter((a: any) => a.subtype === 'LOOKALIKE').length, color: 'text-amber-600' },
                    { icon: Globe, label: 'Saved audiences', value: saved.length, color: 'text-green-600' },
                ].map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.label}>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">{kpi.label}</div>
                                    <div className="text-xl font-bold">{kpi.value}</div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Tabs defaultValue="custom">
                <TabsList>
                    <TabsTrigger value="custom">Custom ({audiences.length})</TabsTrigger>
                    <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 mt-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search audiences…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                <TabsContent value="custom" className="mt-3">
                    <div className="border rounded-lg bg-background overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/60">
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Delivery</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6}><Skeleton className="h-8" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredCustom.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No custom audiences yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCustom.map((a: any) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="font-medium">
                                                <div>{a.name}</div>
                                                {a.description && (
                                                    <div className="text-xs text-muted-foreground">{a.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{a.subtype || 'CUSTOM'}</Badge>
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {a.approximate_count_lower_bound
                                                    ? `> ${formatNumber(a.approximate_count_lower_bound)}`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={a.delivery_status?.code === 200 ? 'default' : 'secondary'}
                                                >
                                                    {a.delivery_status?.description || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {a.time_updated
                                                    ? new Date(a.time_updated * 1000).toLocaleDateString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(a.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="saved" className="mt-3">
                    <div className="border rounded-lg bg-background overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/60">
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Size</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {saved.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                            No saved audiences.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    saved.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="font-medium">{a.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {a.description || '—'}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {formatNumber(a.approximate_count_lower_bound || 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
