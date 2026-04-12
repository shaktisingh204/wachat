'use client';

import Link from 'next/link';
import { FileText, Plus, Download, Calendar, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TEMPLATES = [
    { id: 'performance', name: 'Performance overview', desc: 'Key metrics by campaign and ad.', icon: FileText },
    { id: 'creative', name: 'Creative performance', desc: 'Best-performing ads by objective.', icon: FileText },
    { id: 'audience', name: 'Audience breakdown', desc: 'Reach & spend by age, gender and location.', icon: FileText },
    { id: 'roas', name: 'ROAS & conversions', desc: 'Purchase metrics and attribution.', icon: FileText },
    { id: 'frequency', name: 'Frequency report', desc: 'Reach vs frequency trends.', icon: FileText },
    { id: 'funnel', name: 'Funnel analysis', desc: 'From impression to conversion.', icon: FileText },
];

export default function ReportsPage() {
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
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-1" /> Import
                    </Button>
                    <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
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
                                        <Button size="sm" variant="outline" className="flex-1">
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
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="mt-3 font-medium">No saved reports yet</p>
                        <p className="text-sm text-muted-foreground">
                            Save a template to reuse it.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
