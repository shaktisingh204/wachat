
import React from 'react';
import { cn } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Search,
    GitFork,
    LayoutGrid,
    Sparkles,
} from 'lucide-react';

type DraggableItemProps = {
    label: string;
    description?: string;
    Icon: React.ComponentType<{ className?: string }>;
    iconColor?: string;
    accent: 'violet' | 'amber';
    onDragStart: (e: React.DragEvent) => void;
};

const accentMap = {
    violet: {
        iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
        iconText: 'text-violet-600 dark:text-violet-400',
        hoverBorder: 'hover:border-violet-500/40',
        hoverBg: 'hover:bg-violet-500/5',
    },
    amber: {
        iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
        iconText: 'text-amber-600 dark:text-amber-400',
        hoverBorder: 'hover:border-amber-500/40',
        hoverBg: 'hover:bg-amber-500/5',
    },
};

const DraggableItem = ({ label, description, Icon, iconColor, accent, onDragStart }: DraggableItemProps) => {
    const a = accentMap[accent];
    return (
        <div
            draggable
            onDragStart={onDragStart}
            className={cn(
                "group relative flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card/50",
                "cursor-grab active:cursor-grabbing transition-all duration-150",
                "hover:shadow-sm hover:-translate-y-0.5",
                a.hoverBorder, a.hoverBg,
            )}
        >
            <div className={cn(
                "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border border-border/40 transition-transform group-hover:scale-105",
                a.iconBg
            )}>
                <Icon className={cn("h-4.5 w-4.5", iconColor || a.iconText)} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-tight truncate">{label}</div>
                {description && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">{description}</div>
                )}
            </div>
        </div>
    );
};

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
    const showLogic = 'condition'.includes(search.toLowerCase()) || search === '';

    return (
        <aside className={cn("flex flex-col h-full", className)}>
            <div className="p-4 pb-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search apps & logic..."
                        className="pl-9 h-9 bg-muted/40 border-border/60 focus-visible:bg-background transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-5 pb-4">
                    {showLogic && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-1 w-1 rounded-full bg-amber-500" />
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Logic</h4>
                            </div>
                            <DraggableItem
                                label="Condition"
                                description="Branch flow on rules"
                                Icon={GitFork}
                                accent="amber"
                                onDragStart={(e) => onDragStart(e, 'condition')}
                            />
                        </div>
                    )}

                    {categories.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-1 w-1 rounded-full bg-violet-500" />
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Apps & Actions</h4>
                            </div>
                            <Accordion type="multiple" defaultValue={['SabNode Apps', 'Core Apps']} className="w-full">
                                {categories.map((category) => (
                                    <AccordionItem key={category} value={category} className="border-none">
                                        <AccordionTrigger className="hover:no-underline py-2 text-[12px] font-semibold text-foreground/80 hover:text-foreground">
                                            <div className="flex items-center gap-2 flex-1">
                                                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{category}</span>
                                                <span className="ml-auto mr-2 text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                                    {groupedApps[category].length}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-2">
                                            <div className="grid grid-cols-1 gap-2">
                                                {groupedApps[category].map((app) => (
                                                    <DraggableItem
                                                        key={app.appId}
                                                        label={app.name}
                                                        description={(app as any).category || 'App Integration'}
                                                        Icon={app.icon || Sparkles}
                                                        iconColor={app.iconColor}
                                                        accent="violet"
                                                        onDragStart={(e) => onDragStart(e, 'action', app.appId)}
                                                    />
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    )}

                    {categories.length === 0 && !showLogic && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            No results for &quot;{search}&quot;
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
};
