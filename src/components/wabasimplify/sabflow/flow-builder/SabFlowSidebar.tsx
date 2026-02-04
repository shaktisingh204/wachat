
import React from 'react';
import { cn } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search,
    GitFork,
    Zap,
    LayoutGrid
} from 'lucide-react';

export const SabFlowSidebar = ({ className }: { className?: string }) => {
    const [search, setSearch] = React.useState('');

    const onDragStart = (event: React.DragEvent, type: string, appId?: string) => {
        const data = appId ? JSON.stringify({ type, appId }) : JSON.stringify({ type });
        event.dataTransfer.setData('application/reactflow', data);
        event.dataTransfer.effectAllowed = 'move';
    };

    const groupedApps = React.useMemo(() => {
        const apps = sabnodeAppActions.filter(app => {
            if (search && !app.name.toLowerCase().includes(search.toLowerCase())) return false;
            // Filter out apps that are ONLY triggers if we are adding actions (optional, but keep for now)
            return true;
        });

        return apps.reduce((acc, app) => {
            const category = app.category || 'SabNode Apps';
            if (!acc[category]) acc[category] = [];
            acc[category].push(app);
            return acc;
        }, {} as Record<string, typeof sabnodeAppActions>);
    }, [search]);

    const categories = Object.keys(groupedApps).sort();

    return (
        <aside className={cn("flex flex-col h-full", className)}>
            <div className="p-4 pb-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search apps..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-4">
                    {/* Logic Section */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground px-1">Logic</h4>
                        <div
                            className="flex items-center gap-3 p-3 bg-card border rounded-md cursor-grab active:cursor-grabbing hover:border-primary transition-colors hover:shadow-sm"
                            draggable
                            onDragStart={(e) => onDragStart(e, 'condition')}
                        >
                            <div className="p-1.5 bg-orange-100 text-orange-600 rounded">
                                <GitFork className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-medium">Condition</span>
                        </div>
                    </div>

                    {/* Apps Sections */}
                    <Accordion type="multiple" defaultValue={['SabNode Apps', 'Core Apps']} className="w-full">
                        {categories.map((category) => (
                            <AccordionItem key={category} value={category} className="border-none">
                                <AccordionTrigger className="hover:no-underline py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                    <div className="flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4" />
                                        {category}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 pb-2">
                                    <div className="grid grid-cols-1 gap-2">
                                        {groupedApps[category].map((app) => (
                                            <div
                                                key={app.appId}
                                                className="flex items-center gap-3 p-3 bg-card border rounded-md cursor-grab active:cursor-grabbing hover:border-primary transition-colors hover:shadow-sm"
                                                draggable
                                                onDragStart={(e) => onDragStart(e, 'action', app.appId)}
                                            >
                                                <div className="p-1.5 bg-muted rounded text-muted-foreground">
                                                    <app.icon className={cn("h-5 w-5", app.iconColor)} />
                                                </div>
                                                <span className="text-sm font-medium">{app.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </ScrollArea>
        </aside>
    );
};
