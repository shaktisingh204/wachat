'use client';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useRouter } from 'next/navigation';
import { Calendar, Download, FileText, Mail, Plus, Save, Search, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

const TEMPLATES = [
    { id: 'performance', name: 'Performance overview', desc: 'Key metrics by campaign and ad.', icon: FileText },
    { id: 'creative', name: 'Creative performance', desc: 'Best-performing ads by objective.', icon: FileText },
    { id: 'audience', name: 'Audience breakdown', desc: 'Reach and spend by age, gender and location.', icon: FileText },
    { id: 'roas', name: 'ROAS and conversions', desc: 'Purchase metrics and attribution.', icon: FileText },
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
        },
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
            setSelectedIds(new Set(filteredReports.map((r) => r.id)));
        }
    };

    const deleteSelected = () => {
        const newReports = savedReports.filter((r) => !selectedIds.has(r.id));
        updateReports(newReports);
        setSelectedIds(new Set());
        toast.success('Selected reports deleted');
    };

    const exportToCSV = () => {
        const reportsToExport = savedReports.filter((r) => selectedIds.size === 0 || selectedIds.has(r.id));
        if (reportsToExport.length === 0) return;

        const headers = ['ID', 'Name', 'Date Range', 'Level', 'Created At'];
        const csvContent = [
            headers.join(','),
            ...reportsToExport.map((r) => `"${r.id}","${r.name.replace(/"/g, '""')}","${r.dateRange}","${r.level}","${r.createdAt}"`),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'reports_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Reports exported successfully');
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
        toast.success('Report saved');
        setCreateOpen(false);
        reset();
    };

    const filteredReports = savedReports.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Reports" />
            <AmHeader
                title="Reports"
                description="Build, save and schedule custom performance reports."
                actions={
                    <div className="flex gap-2">
                        <SabFileToFileButton
                            variant="outline"
                            accept="all"
                            onPickFile={(file) => {
                                toast.success(`Report imported: ${file.name}`);
                            }}
                            onError={(err) => toast.error(err.message || 'Failed to import report')}
                        >
                            <Download className="h-4 w-4 mr-1" /> Import
                        </SabFileToFileButton>
                        <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
                            Create custom report
                        </Button>
                    </div>
                }
            />

            <div>
                <h2 className="text-sm font-semibold mb-2 text-[var(--st-text)]">Templates</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                            <Card key={t.id} variant="interactive" className="cursor-pointer">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] flex items-center justify-center text-[var(--st-accent)]">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <Badge tone="neutral" kind="outline">Template</Badge>
                                    </div>
                                    <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <p className="text-xs text-[var(--st-text-secondary)]">{t.desc}</p>
                                    <div className="mt-3 flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            iconLeft={Mail}
                                            className="flex-1"
                                            onClick={() => router.push('/dashboard/ad-manager/insights?preset=' + t.id)}
                                        >
                                            Schedule
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => router.push('/dashboard/ad-manager/insights')}
                                        >
                                            Open
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
                    <h2 className="text-sm font-semibold text-[var(--st-text)]">Saved reports</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            type="text"
                            placeholder="Search reports..."
                            aria-label="Search reports"
                            iconLeft={Search}
                            className="w-[200px]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {selectedIds.size > 0 && (
                            <Button size="sm" variant="danger" iconLeft={Trash2} onClick={deleteSelected}>
                                Delete ({selectedIds.size})
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            iconLeft={Download}
                            onClick={exportToCSV}
                            disabled={savedReports.length === 0}
                        >
                            Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                        </Button>
                    </div>
                </div>

                {!isHydrated ? (
                    <div className="py-12 flex justify-center items-center">
                        <Spinner size="lg" label="Loading reports" />
                    </div>
                ) : filteredReports.length === 0 ? (
                    <Card className="border-dashed">
                        <CardBody className="py-6">
                            <EmptyState
                                icon={Calendar}
                                title="No saved reports found"
                                description={
                                    searchQuery
                                        ? 'Try adjusting your search query.'
                                        : 'Create and save a custom report to see it here.'
                                }
                            />
                        </CardBody>
                    </Card>
                ) : (
                    <>
                        <div className="px-1">
                            <Checkbox
                                id="select-all"
                                label="Select all"
                                checked={selectedIds.size === filteredReports.length && filteredReports.length > 0}
                                onChange={toggleSelectAll}
                            />
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredReports.map((r) => (
                                <Card key={r.id} variant="interactive" className="relative">
                                    <div className="absolute top-4 left-4 z-10">
                                        <Checkbox
                                            aria-label={`Select ${r.name}`}
                                            checked={selectedIds.has(r.id)}
                                            onChange={() => toggleSelect(r.id)}
                                        />
                                    </div>
                                    <CardHeader className="pb-2 pl-12">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-base truncate pr-2" title={r.name}>{r.name}</CardTitle>
                                            <IconButton
                                                icon={Trash2}
                                                label={`Delete ${r.name}`}
                                                variant="ghost"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() => {
                                                    const updated = savedReports.filter((s) => s.id !== r.id);
                                                    updateReports(updated);
                                                    const nextSelected = new Set(selectedIds);
                                                    nextSelected.delete(r.id);
                                                    setSelectedIds(nextSelected);
                                                    toast.success('Report deleted');
                                                }}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardBody className="pl-12">
                                        <p className="text-xs text-[var(--st-text-secondary)]">
                                            {r.dateRange.replace(/_/g, ' ')} . {r.level} level
                                        </p>
                                        <p className="text-[10px] text-[var(--st-text-secondary)] mt-1">
                                            Saved {new Date(r.createdAt).toLocaleDateString()}
                                        </p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            block
                                            className="mt-3"
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
                        <DialogTitle>Create custom report</DialogTitle>
                        <DialogDescription>Choose metrics, dimensions, and date range for your report.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Field label="Report name" error={errors.name?.message}>
                            <Input placeholder="e.g. Weekly performance summary" {...register('name')} />
                        </Field>
                        <Field label="Date range">
                            <Controller
                                name="dateRange"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger aria-label="Date range"><SelectValue /></SelectTrigger>
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
                        </Field>
                        <Field label="Level">
                            <Controller
                                name="level"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger aria-label="Level"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="account">Account</SelectItem>
                                            <SelectItem value="campaign">Campaign</SelectItem>
                                            <SelectItem value="adset">Ad set</SelectItem>
                                            <SelectItem value="ad">Ad</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </Field>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); reset(); }}>Cancel</Button>
                            <Button type="submit" variant="secondary" iconLeft={Save}>Save</Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleSubmit((data) => {
                                    onSubmit(data);
                                    router.push('/dashboard/ad-manager/insights');
                                })}
                            >
                                Generate report
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
