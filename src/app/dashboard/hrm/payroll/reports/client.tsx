'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/zoruui';
import { CalendarCheck, CalendarX, FileSpreadsheet, BookOpen, Star } from 'lucide-react';
import Link from 'next/link';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const generateSparklineData = () => {
    // Generate a random-looking trend line for demonstration
    let current = Math.floor(Math.random() * 30) + 20;
    return Array.from({ length: 15 }).map(() => {
        current += Math.floor(Math.random() * 10) - 4; // slight bias
        return { value: current };
    });
};

const REPORT_CATEGORIES = [
    {
        id: 'attendance',
        href: '/dashboard/hrm/payroll/reports/attendance',
        icon: CalendarCheck,
        title: 'Attendance Report',
        description: 'Track employee attendance, absences, late arrivals, WFH days, and half-days across any date range.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50',
        stroke: '#10b981', // emerald-500
    },
    {
        id: 'leave',
        href: '/dashboard/hrm/payroll/reports/leave',
        icon: CalendarX,
        title: 'Leave Report',
        description: 'View leave allocation, usage, pending requests, and remaining balances by employee and leave type.',
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        stroke: '#f59e0b', // amber-500
    },
    {
        id: 'payroll',
        href: '/dashboard/hrm/payroll/reports/payroll-summary',
        icon: FileSpreadsheet,
        title: 'Payroll Summary',
        description: 'Monthly payroll breakdown with gross salary, PF, ESI, TDS, professional tax, and net pay per employee.',
        color: 'text-sky-500',
        bg: 'bg-sky-50',
        stroke: '#0ea5e9', // sky-500
    },
    {
        id: 'salary',
        href: '/dashboard/hrm/payroll/reports/salary-register',
        icon: BookOpen,
        title: 'Salary Register',
        description: 'Detailed salary component register — basic, HRA, allowances, and all deductions for any month.',
        color: 'text-accent-foreground',
        bg: 'bg-accent',
        stroke: '#52525b', // zinc-500
    },
];

export default function HrReportsIndexClient() {
    const [favourites, setFavourites] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const [sparklineData, setSparklineData] = useState<Record<string, { value: number }[]>>({});

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('hr-reports-favourites');
        if (saved) {
            try {
                setFavourites(JSON.parse(saved));
            } catch (e) {}
        }
        
        // Generate stable sparkline data on mount
        const data: Record<string, { value: number }[]> = {};
        REPORT_CATEGORIES.forEach(report => {
            data[report.id] = generateSparklineData();
        });
        setSparklineData(data);
    }, []);

    const toggleFavourite = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        setFavourites(prev => {
            const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            localStorage.setItem('hr-reports-favourites', JSON.stringify(next));
            return next;
        });
    };

    const sortedReports = [...REPORT_CATEGORIES].sort((a, b) => {
        const aFav = favourites.includes(a.id);
        const bFav = favourites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
    });

    return (
        <EntityListShell
            title="Payroll Reports"
            subtitle="Generate and download detailed HR and payroll reports for your organisation."
        >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
                {sortedReports.map((report) => {
                    const { id, href, icon: Icon, title, description, color, bg, stroke } = report;
                    const isFav = favourites.includes(id);
                    
                    return (
                        <Link key={id} href={href} className="group block h-full focus-visible:outline-none">
                            <Card className="relative flex h-full flex-col p-6 transition-shadow duration-150 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary/30">
                                <button
                                    onClick={(e) => toggleFavourite(e, id)}
                                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
                                >
                                    <Star className={`h-4 w-4 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
                                </button>
                                
                                <div className={`mb-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                                    <Icon className={`h-5 w-5 ${color}`} strokeWidth={1.75} />
                                </div>
                                <h2 className="mb-1.5 text-[15px] font-medium text-zoru-ink">{title}</h2>
                                <p className="mb-6 flex-grow text-[12.5px] leading-relaxed text-zoru-ink-muted">{description}</p>
                                
                                <div className="mt-auto">
                                    <div className="mb-4 h-12 w-full opacity-60 transition-opacity duration-300 group-hover:opacity-100">
                                        {mounted && sparklineData[id] && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={sparklineData[id]}>
                                                    <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                                                    <Line 
                                                        type="monotone" 
                                                        dataKey="value" 
                                                        stroke={stroke} 
                                                        strokeWidth={2} 
                                                        dot={false} 
                                                        isAnimationActive={false}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                    <p className={`text-[12.5px] font-medium ${color}`}>View report →</p>
                                </div>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </EntityListShell>
    );
}
