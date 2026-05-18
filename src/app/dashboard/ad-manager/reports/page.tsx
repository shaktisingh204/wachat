'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { FileText,
  Plus,
  Download,
  Calendar,
  Mail,
  Save,
  Trash2 } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

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
        <div className="space-y-6">
            <AmBreadcrumb page="Reports" />
            <AmHeader
                title="Reports"
                description="Build, save and schedule custom performance reports."
                actions={
                    <div className="flex gap-2">
                        <ZoruButton variant="outline" onClick={() => fileRef.current?.click()}>
                            <Download className="h-4 w-4 mr-1" /> Import
                        </ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" /> Create custom report
                        </ZoruButton>
                    </div>
                }
            />

            <div>
                <h2 className="text-sm font-semibold mb-2">Templates</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                            <ZoruCard key={t.id} className="cursor-pointer hover:border-[#1877F2]/50 transition-colors">
                                <ZoruCardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <ZoruBadge variant="outline">Template</ZoruBadge>
                                    </div>
                                    <ZoruCardTitle className="text-base mt-2">{t.name}</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                                    <div className="mt-3 flex gap-2">
                                        <ZoruButton size="sm" variant="outline" className="flex-1" onClick={() => router.push('/dashboard/ad-manager/insights?preset=' + t.id)}>
                                            <Mail className="h-3 w-3 mr-1" /> Schedule
                                        </ZoruButton>
                                        <ZoruButton size="sm" variant="outline" asChild className="flex-1">
                                            <Link href="/dashboard/ad-manager/insights">Open</Link>
                                        </ZoruButton>
                                    </div>
                                </ZoruCardContent>
                            </ZoruCard>
                        );
                    })}
                </div>
            </div>

            <div>
                <h2 className="text-sm font-semibold mb-2">Saved reports</h2>
                {savedReports.length === 0 ? (
                    <ZoruCard className="border-dashed">
                        <ZoruCardContent className="py-12 text-center">
                            <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
                            <p className="mt-3 font-medium">No saved reports yet</p>
                            <p className="text-sm text-muted-foreground">
                                Create and save a custom report to see it here.
                            </p>
                        </ZoruCardContent>
                    </ZoruCard>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {savedReports.map((r) => (
                            <ZoruCard key={r.id} className="hover:border-[#1877F2]/50 transition-colors">
                                <ZoruCardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <ZoruCardTitle className="text-base">{r.name}</ZoruCardTitle>
                                        <ZoruButton
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
                                        </ZoruButton>
                                    </div>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <p className="text-xs text-muted-foreground">
                                        {r.dateRange.replace(/_/g, ' ')} &middot; {r.level} level
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Saved {new Date(r.createdAt).toLocaleDateString()}
                                    </p>
                                    <ZoruButton
                                        size="sm"
                                        variant="outline"
                                        className="mt-2 w-full"
                                        onClick={() => router.push('/dashboard/ad-manager/insights')}
                                    >
                                        Open
                                    </ZoruButton>
                                </ZoruCardContent>
                            </ZoruCard>
                        ))}
                    </div>
                )}
            </div>

            <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Create Custom Report</ZoruDialogTitle>
                        <ZoruDialogDescription>Choose metrics, dimensions, and date range for your report.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel>Report Name</ZoruLabel>
                            <ZoruInput
                                placeholder="e.g. Weekly Performance Summary"
                                value={newReportName}
                                onChange={(e) => setNewReportName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Date Range</ZoruLabel>
                            <ZoruSelect value={newReportDateRange} onValueChange={setNewReportDateRange}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="today">Today</ZoruSelectItem>
                                    <ZoruSelectItem value="yesterday">Yesterday</ZoruSelectItem>
                                    <ZoruSelectItem value="last_7d">Last 7 days</ZoruSelectItem>
                                    <ZoruSelectItem value="last_30d">Last 30 days</ZoruSelectItem>
                                    <ZoruSelectItem value="this_month">This month</ZoruSelectItem>
                                    <ZoruSelectItem value="last_month">Last month</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Level</ZoruLabel>
                            <ZoruSelect value={newReportLevel} onValueChange={setNewReportLevel}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="account">Account</ZoruSelectItem>
                                    <ZoruSelectItem value="campaign">Campaign</ZoruSelectItem>
                                    <ZoruSelectItem value="adset">Ad Set</ZoruSelectItem>
                                    <ZoruSelectItem value="ad">Ad</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setCreateOpen(false)}>Cancel</ZoruButton>
                        <ZoruButton
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
                        </ZoruButton>
                        <ZoruButton className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => { setCreateOpen(false); router.push('/dashboard/ad-manager/insights'); }}>
                            Generate Report
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { toast({ title: 'Report imported', description: e.target.files[0].name }); } }} />
        </div>
    );
}
