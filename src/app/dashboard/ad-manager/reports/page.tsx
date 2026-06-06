'use client';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Download, Calendar, Mail, Save, Trash2, Search, Loader2 } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
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

const createReportSchema = z.object({
  name: z.string().min(1, 'Report name is required'),
  dateRange: z.string(),
  level: z.string(),
});

type CreateReportFormValues = z.infer<typeof createReportSchema>;

export default function ReportsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [createOpen, setCreateOpen] = React.useState(false);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [savedReports, setSavedReports] = React.useState<SavedReport[]>([]);
    const [isHydrated, setIsHydrated] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateReportFormValues>({
      resolver: zodResolver(createReportSchema),
      defaultValues: {
        name: '',
        dateRange: 'last_7d',
        level: 'campaign',
      }
    });

    React.useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('ad-manager-saved-reports') || '[]');
            setSavedReports(stored);
        } catch {
            setSavedReports([]);
        }
        setIsHydrated(true);
    }, []);

    const updateReports = (newReports: SavedReport[]) => {
        setSavedReports(newReports);
        localStorage.setItem('ad-manager-saved-reports', JSON.stringify(newReports));
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredReports.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredReports.map(r => r.id)));
        }
    };

    const deleteSelected = () => {
        const newReports = savedReports.filter(r => !selectedIds.has(r.id));
        updateReports(newReports);
        setSelectedIds(new Set());
        toast({ title: 'Selected reports deleted' });
    };

    const exportToCSV = () => {
        const reportsToExport = savedReports.filter(r => selectedIds.size === 0 || selectedIds.has(r.id));
        if (reportsToExport.length === 0) return;

        const headers = ['ID', 'Name', 'Date Range', 'Level', 'Created At'];
        const csvContent = [
            headers.join(','),
            ...reportsToExport.map(r => `"${r.id}","${r.name.replace(/"/g, '""')}","${r.dateRange}","${r.level}","${r.createdAt}"`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'reports_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Reports exported successfully' });
    };

    const onSubmit = (data: CreateReportFormValues) => {
        const report: SavedReport = {
            id: Date.now().toString(),
            name: data.name,
            dateRange: data.dateRange,
            level: data.level,
            createdAt: new Date().toISOString(),
        };
        updateReports([...savedReports, report]);
        toast({ title: 'Report saved' });
        setCreateOpen(false);
        reset();
    };

    const filteredReports = savedReports.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Reports" />
            <AmHeader
                title="Reports"
                description="Build, save and schedule custom performance reports."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => fileRef.current?.click()}>
                            <Download className="h-4 w-4 mr-1" /> Import
                        </Button>
                        <Button className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" /> Create custom report
                        </Button>
                    </div>
                }
            />

            <div>
                <h2 className="text-sm font-semibold mb-2">Templates</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                            <Card key={t.id} className="cursor-pointer hover:border-[var(--st-border)]/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-lg bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <Badge variant="outline">Template</Badge>
                                    </div>
                                    <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <p className="text-xs text-[var(--st-text-secondary)]">{t.desc}</p>
                                    <div className="mt-3 flex gap-2">
                                        <Button size="sm" variant="outline" className="flex-1" onClick={() => router.push('/dashboard/ad-manager/insights?preset=' + t.id)}>
                                            <Mail className="h-3 w-3 mr-1" /> Schedule
                                        </Button>
                                        <Button size="sm" variant="outline" asChild className="flex-1">
                                            <Link href="/dashboard/ad-manager/insights">Open</Link>
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-sm font-semibold">Saved reports</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input
                                type="text"
                                placeholder="Search reports..."
                                className="pl-9 w-[200px] h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {selectedIds.size > 0 && (
                            <>
                                <Button size="sm" variant="destructive" onClick={deleteSelected}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete ({selectedIds.size})
                                </Button>
                            </>
                        )}
                        <Button size="sm" variant="outline" onClick={exportToCSV} disabled={savedReports.length === 0}>
                            <Download className="h-4 w-4 mr-1" /> Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                        </Button>
                    </div>
                </div>

                {!isHydrated ? (
                    <div className="py-12 flex justify-center items-center text-[var(--st-text-secondary)]">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : filteredReports.length === 0 ? (
                    <Card className="border-dashed">
                        <CardBody className="py-12 text-center">
                            <Calendar className="h-10 w-10 mx-auto text-[var(--st-text-secondary)]" />
                            <p className="mt-3 font-medium">No saved reports found</p>
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                {searchQuery ? 'Try adjusting your search query.' : 'Create and save a custom report to see it here.'}
                            </p>
                        </CardBody>
                    </Card>
                ) : (
                    <>
                        {filteredReports.length > 0 && (
                            <div className="flex items-center space-x-2 px-1">
                                <Checkbox 
                                    id="select-all" 
                                    checked={selectedIds.size === filteredReports.length && filteredReports.length > 0} 
                                    onCheckedChange={toggleSelectAll} 
                                />
                                <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Select All
                                </label>
                            </div>
                        )}
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredReports.map((r) => (
                                <Card key={r.id} className="hover:border-[var(--st-border)]/50 transition-colors relative">
                                    <div className="absolute top-4 left-4 z-10">
                                        <Checkbox 
                                            checked={selectedIds.has(r.id)} 
                                            onCheckedChange={() => toggleSelect(r.id)} 
                                        />
                                    </div>
                                    <CardHeader className="pb-2 pl-12">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-base truncate pr-2" title={r.name}>{r.name}</CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-[var(--st-text-secondary)] hover:text-[var(--st-text)] shrink-0"
                                                onClick={() => {
                                                    const updated = savedReports.filter((s) => s.id !== r.id);
                                                    updateReports(updated);
                                                    const nextSelected = new Set(selectedIds);
                                                    nextSelected.delete(r.id);
                                                    setSelectedIds(nextSelected);
                                                    toast({ title: 'Report deleted' });
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardBody className="pl-12">
                                        <p className="text-xs text-[var(--st-text-secondary)]">
                                            {r.dateRange.replace(/_/g, ' ')} &middot; {r.level} level
                                        </p>
                                        <p className="text-[10px] text-[var(--st-text-secondary)] mt-1">
                                            Saved {new Date(r.createdAt).toLocaleDateString()}
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-3 w-full"
                                            onClick={() => router.push('/dashboard/ad-manager/insights')}
                                        >
                                            Open
                                        </Button>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Custom Report</DialogTitle>
                        <DialogDescription>Choose metrics, dimensions, and date range for your report.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Report Name</Label>
                            <Input
                                placeholder="e.g. Weekly Performance Summary"
                                {...register('name')}
                            />
                            {errors.name && <p className="text-xs text-[var(--st-text)]">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Date Range</Label>
                            <Controller
                              name="dateRange"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
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
                              )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Level</Label>
                            <Controller
                              name="level"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="account">Account</SelectItem>
                                        <SelectItem value="campaign">Campaign</SelectItem>
                                        <SelectItem value="adset">Ad Set</SelectItem>
                                        <SelectItem value="ad">Ad</SelectItem>
                                    </SelectContent>
                                </Select>
                              )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); reset(); }}>Cancel</Button>
                            <Button type="submit">
                                <Save className="h-4 w-4 mr-1" /> Save
                            </Button>
                            <Button type="button" className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white" onClick={handleSubmit((data) => {
                                onSubmit(data);
                                router.push('/dashboard/ad-manager/insights');
                            })}>
                                Generate Report
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { toast({ title: 'Report imported', description: e.target.files[0].name }); } }} />
        </div>
    );
}
