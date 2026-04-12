'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Download, Calendar, Mail, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const TEMPLATES = [
    { id: 'performance', name: 'Performance overview', desc: 'Key metrics by campaign and ad.', icon: FileText },
    { id: 'creative', name: 'Creative performance', desc: 'Best-performing ads by objective.', icon: FileText },
    { id: 'audience', name: 'Audience breakdown', desc: 'Reach & spend by age, gender and location.', icon: FileText },
    { id: 'roas', name: 'ROAS & conversions', desc: 'Purchase metrics and attribution.', icon: FileText },
    { id: 'frequency', name: 'Frequency report', desc: 'Reach vs frequency trends.', icon: FileText },
    { id: 'funnel', name: 'Funnel analysis', desc: 'From impression to conversion.', icon: FileText },
];

type SavedReport = {
    id: string;
    name: string;
    dateRange: string;
    level: string;
    createdAt: string;
};

function getSavedReports(): SavedReport[] {
    try {
        return JSON.parse(localStorage.getItem('ad-manager-saved-reports') || '[]');
    } catch {
        return [];
    }
}

function saveSavedReports(reports: SavedReport[]) {
    localStorage.setItem('ad-manager-saved-reports', JSON.stringify(reports));
}

export default function ReportsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [createOpen, setCreateOpen] = React.useState(false);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [savedReports, setSavedReports] = React.useState<SavedReport[]>([]);
    const [newReportName, setNewReportName] = React.useState('');
    const [newReportDateRange, setNewReportDateRange] = React.useState('last_7d');
    const [newReportLevel, setNewReportLevel] = React.useState('campaign');

    React.useEffect(() => {
        setSavedReports(getSavedReports());
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6" /> Reports
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Build, save and schedule custom performance reports.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fileRef.current?.click()}>
                        <Download className="h-4 w-4 mr-1" /> Import
                    </Button>
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Create custom report
                    </Button>
                </div>
            </div>

            <div>
                <h2 className="text-sm font-semibold mb-2">Templates</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                            <Card key={t.id} className="cursor-pointer hover:border-[#1877F2]/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <Badge variant="outline">Template</Badge>
                                    </div>
                                    <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push('/dashboard/ad-manager/insights?preset=' + t.id)}>
                                            <Mail className="h-3 w-3 mr-1" /> Schedule
                                        </Button>
                                        <Button size="sm" variant="outline" asChild className="flex-1">
                                            <Link href="/dashboard/ad-manager/insights">Open</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-sm font-semibold mb-2">Saved reports</h2>
                {savedReports.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
                            <p className="mt-3 font-medium">No saved reports yet</p>
                            <p className="text-sm text-muted-foreground">
                                Create and save a custom report to see it here.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {savedReports.map((r) => (
                            <Card key={r.id} className="hover:border-[#1877F2]/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-base">{r.name}</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                            onClick={() => {
                                                const updated = savedReports.filter((s) => s.id !== r.id);
                                                setSavedReports(updated);
                                                saveSavedReports(updated);
                                                toast({ title: 'Report deleted' });
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">
                                        {r.dateRange.replace(/_/g, ' ')} &middot; {r.level} level
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Saved {new Date(r.createdAt).toLocaleDateString()}
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2 w-full"
                                        onClick={() => router.push('/dashboard/ad-manager/insights')}
                                    >
                                        Open
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Custom Report</DialogTitle>
                        <DialogDescription>Choose metrics, dimensions, and date range for your report.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Report Name</Label>
                            <Input
                                placeholder="e.g. Weekly Performance Summary"
                                value={newReportName}
                                onChange={(e) => setNewReportName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Date Range</Label>
                            <Select value={newReportDateRange} onValueChange={setNewReportDateRange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="yesterday">Yesterday</SelectItem>
                                    <SelectItem value="last_7d">Last 7 days</SelectItem>
                                    <SelectItem value="last_30d">Last 30 days</SelectItem>
                                    <SelectItem value="this_month">This month</SelectItem>
                                    <SelectItem value="last_month">Last month</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Level</Label>
                            <Select value={newReportLevel} onValueChange={setNewReportLevel}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="account">Account</SelectItem>
                                    <SelectItem value="campaign">Campaign</SelectItem>
                                    <SelectItem value="adset">Ad Set</SelectItem>
                                    <SelectItem value="ad">Ad</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (!newReportName.trim()) {
                                    toast({ title: 'Enter a report name', variant: 'destructive' });
                                    return;
                                }
                                const report: SavedReport = {
                                    id: Date.now().toString(),
                                    name: newReportName,
                                    dateRange: newReportDateRange,
                                    level: newReportLevel,
                                    createdAt: new Date().toISOString(),
                                };
                                const updated = [...savedReports, report];
                                setSavedReports(updated);
                                saveSavedReports(updated);
                                toast({ title: 'Report saved' });
                                setNewReportName('');
                            }}
                        >
                            <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => { setCreateOpen(false); router.push('/dashboard/ad-manager/insights'); }}>
                            Generate Report
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { toast({ title: 'Report imported', description: e.target.files[0].name }); } }} />
        </div>
    );
}
