'use client';

import React, { useState, useRef } from 'react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { Button, Card } from '@/components/zoruui';
import { Download, FileText, Image as ImageIcon, LayoutDashboard, Settings2, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ScheduleReportDialog } from './schedule-report-dialog';

type AnalyticsData = {
    financials: { name: string; revenue: number; expense: number }[];
    funnel: { name: string; value: number }[];
    kpis: {
        totalRevenue: number;
        totalExpense: number;
        netProfit: number;
        totalLeads: number;
    };
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function SortableWidget({ id, children, isEditMode }: { id: string; children: React.ReactNode; isEditMode: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group h-full">
            {isEditMode && (
                <div 
                    {...attributes} 
                    {...listeners}
                    className="absolute top-2 right-2 z-10 p-2 cursor-grab active:cursor-grabbing bg-background/80 rounded-md backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
            {children}
        </div>
    );
}

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [widgetOrder, setWidgetOrder] = useState(['financial', 'funnel']);

    if (!data) return <div className="p-4">No data available</div>;

    const { financials, funnel, kpis } = data;

    const hasData =
        kpis.totalRevenue > 0 ||
        kpis.totalExpense > 0 ||
        kpis.totalLeads > 0 ||
        financials.some(f => f.revenue > 0 || f.expense > 0) ||
        funnel.some(f => f.value > 0);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            setWidgetOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    const exportToPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('analytics-report.pdf');
        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const exportToPNG = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            const link = document.createElement('a');
            link.download = 'analytics-dashboard.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error exporting PNG:', error);
        } finally {
            setIsExporting(false);
        }
    };

    if (!hasData) {
        return (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-lg border border-dashed border-border bg-zoru-surface p-8 text-center">
                <div className="rounded-full bg-zoru-surface-2 p-4">
                    <LayoutDashboard className="h-8 w-8 text-zoru-ink-muted" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-foreground">No Analytics Data</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                        Your workspace is looking a little empty. Start adding leads, deals, or logging expenses to see your metrics come to life.
                    </p>
                </div>
            </div>
        );
    }

    const widgets: Record<string, React.ReactNode> = {
        'financial': (
            <Card className="col-span-1 h-full p-0">
                <div className="p-5 border-b border-border flex justify-between items-center">
                    <h3 className="text-foreground font-semibold">Financial Performance</h3>
                </div>
                <div className="p-5 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financials}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                            <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#adfa1d" radius={[4, 4, 0, 0]} name="Revenue" />
                            <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Expenses" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        ),
        'funnel': (
            <Card className="col-span-1 h-full p-0">
                <div className="p-5 border-b border-border flex justify-between items-center">
                    <h3 className="text-foreground font-semibold">Lead Funnel</h3>
                </div>
                <div className="p-5 h-[300px] flex justify-center">
                    {funnel.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={funnel}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {funnel.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No lead data available
                        </div>
                    )}
                </div>
            </Card>
        )
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-end items-center gap-2">
                <Button 
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="gap-2"
                >
                    <Settings2 className="h-4 w-4" />
                    {isEditMode ? 'Finish Editing' : 'Customize Dashboard'}
                </Button>
                <ScheduleReportDialog />
                <div className="flex items-center bg-muted rounded-md p-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={exportToPDF}
                        disabled={isExporting}
                        className="gap-2 text-xs h-8"
                    >
                        <FileText className="h-3 w-3" />
                        PDF
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={exportToPNG}
                        disabled={isExporting}
                        className="gap-2 text-xs h-8"
                    >
                        <ImageIcon className="h-3 w-3" />
                        PNG
                    </Button>
                </div>
            </div>

            <div ref={dashboardRef} className="space-y-6 p-1">
                {/* KPIs */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Total Revenue</h3>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">₹{kpis.totalRevenue.toLocaleString()}</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Total Expenses</h3>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">₹{kpis.totalExpense.toLocaleString()}</div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Net Profit</h3>
                        </div>
                        <div>
                            <div className={`text-2xl font-bold ${kpis.netProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                ₹{kpis.netProfit.toLocaleString()}
                            </div>
                        </div>
                    </Card>
                    <Card>
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Total Leads</h3>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">{kpis.totalLeads}</div>
                        </div>
                    </Card>
                </div>

                {/* Charts */}
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={widgetOrder}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            {widgetOrder.map((id) => (
                                <SortableWidget key={id} id={id} isEditMode={isEditMode}>
                                    {widgets[id]}
                                </SortableWidget>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}
