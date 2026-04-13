"use client";

import { useMemo, useState } from "react";
import {
    BadgeX, ChevronRight, Layers, Layout, Plus, Search, Trash2, MoreHorizontal,
    MousePointerClick, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { declarativeFlowComponents } from "@/components/wabasimplify/meta-flow-templates";

interface MetaFlowNavigatorProps {
    screens: any[];
    selectedScreenId: string | null;
    onSelectScreen: (screenId: string) => void;
    onAddScreen: () => void;
    onDeleteScreen: (screenId: string) => void;
    selectedComponent: any | null;
    onSelectComponent: (component: any) => void;
    onDeleteComponent: (identifier: any) => void;
    onAddComponent: (screenId: string, type: string) => void;
    onPublish?: () => void;
}

function flattenLayoutChildren(screen: any): any[] {
    // Return every component inside the layout (Form, NavigationList, If/Switch branches).
    const out: any[] = [];
    const stack: any[] = Array.isArray(screen?.layout?.children) ? [...screen.layout.children] : [];
    while (stack.length) {
        const node = stack.shift();
        if (!node || typeof node !== 'object') continue;
        out.push(node);
        if (Array.isArray(node.children)) stack.unshift(...node.children);
        if (Array.isArray(node.then)) stack.unshift(...node.then);
        if (Array.isArray(node.else)) stack.unshift(...node.else);
        if (node.cases && typeof node.cases === 'object') {
            for (const v of Object.values(node.cases)) {
                if (Array.isArray(v)) stack.unshift(...v);
            }
        }
    }
    return out;
}

export function MetaFlowNavigator({
    screens,
    selectedScreenId,
    onSelectScreen,
    onAddScreen,
    onDeleteScreen,
    selectedComponent,
    onSelectComponent,
    onDeleteComponent,
    onAddComponent,
    onPublish,
}: MetaFlowNavigatorProps) {
    const [tab, setTab] = useState<'screens' | 'palette'>('screens');
    const [paletteQuery, setPaletteQuery] = useState('');

    const filteredPalette = useMemo(() => {
        const q = paletteQuery.trim().toLowerCase();
        if (!q) return declarativeFlowComponents;
        return declarativeFlowComponents
            .map(group => ({
                ...group,
                components: group.components.filter(c =>
                    c.type.toLowerCase().includes(q) ||
                    c.label.toLowerCase().includes(q) ||
                    c.description.toLowerCase().includes(q),
                ),
            }))
            .filter(g => g.components.length > 0);
    }, [paletteQuery]);

    return (
        <div className="flex h-full flex-col border-r bg-muted/10">
            <div className="flex items-center justify-between border-b bg-background p-3">
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <Layers className="h-4 w-4" /> Flow builder
                </span>
                {onPublish ? (
                    <Button variant="ghost" size="sm" onClick={onPublish} className="h-7 px-2 text-[11px]">
                        Quick publish
                    </Button>
                ) : null}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex flex-1 flex-col overflow-hidden">
                <TabsList className="mx-3 mt-3 grid h-8 grid-cols-2">
                    <TabsTrigger value="screens" className="text-[11.5px]">Screens</TabsTrigger>
                    <TabsTrigger value="palette" className="text-[11.5px]">Components</TabsTrigger>
                </TabsList>

                <TabsContent value="screens" className="m-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                            {screens.length} screen{screens.length === 1 ? '' : 's'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddScreen} title="Add screen">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="h-[calc(100%-2.5rem)] px-2">
                        <Accordion type="single" collapsible className="w-full" value={selectedScreenId || undefined}>
                            {screens.map((screen) => {
                                const comps = flattenLayoutChildren(screen);
                                return (
                                    <AccordionItem value={screen.id} key={screen.id} className="mb-1 border-b-0">
                                        <div className={cn(
                                            "group flex items-center rounded-md pr-1 transition-colors",
                                            selectedScreenId === screen.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                                        )}>
                                            <AccordionTrigger
                                                onClick={() => onSelectScreen(screen.id)}
                                                className="flex-1 px-3 py-2 text-sm hover:no-underline"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Layout className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                                    <span className="truncate">{screen.title || screen.id}</span>
                                                    {screen.terminal ? (
                                                        <span className="ml-1 rounded bg-green-100 px-1 text-[9px] font-semibold uppercase text-green-800 dark:bg-green-950 dark:text-green-300">
                                                            terminal
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </AccordionTrigger>

                                            <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                                            <MoreHorizontal className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52">
                                                        <DropdownMenuLabel>Screen actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => { onSelectScreen(screen.id); setTab('palette'); }}>
                                                            <Plus className="mr-2 h-3 w-3" /> Add component
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(screen.id)}>
                                                            <Copy className="mr-2 h-3 w-3" /> Copy screen ID
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteScreen(screen.id); }}
                                                    title="Delete screen"
                                                >
                                                    <BadgeX className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        <AccordionContent className="pb-2 pl-4 pr-1 pt-1">
                                            <div className="space-y-0.5 border-l px-2">
                                                {comps.length === 0 ? (
                                                    <div className="px-2 py-2 text-[11px] italic text-muted-foreground/60">
                                                        No components. Open the Components tab to add.
                                                    </div>
                                                ) : comps.map((comp: any, idx: number) => (
                                                    <div
                                                        key={(comp.name || comp._id || `${comp.type}-${idx}`) + idx}
                                                        className={cn(
                                                            "group/row flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors",
                                                            (selectedComponent === comp || (selectedComponent?.name && selectedComponent.name === comp.name))
                                                                ? "bg-primary/10 font-medium text-primary"
                                                                : "text-muted-foreground hover:bg-muted",
                                                        )}
                                                        onClick={(e) => { e.stopPropagation(); onSelectScreen(screen.id); onSelectComponent(comp); }}
                                                    >
                                                        <span className="flex flex-1 items-center gap-2 truncate">
                                                            {comp.type === 'Footer' ? <MousePointerClick className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                            <span className="truncate">{comp.label || comp.text || comp.name || comp.type}</span>
                                                            <span className="ml-auto shrink-0 rounded bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">
                                                                {comp.type}
                                                            </span>
                                                        </span>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="-mr-1 h-5 w-5 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100"
                                                            onClick={(e) => { e.stopPropagation(); onDeleteComponent(comp.name || comp); }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>

                        {screens.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                <p>No screens yet.</p>
                                <Button variant="link" size="sm" onClick={onAddScreen} className="mt-2 text-primary">
                                    Add your first screen
                                </Button>
                            </div>
                        ) : null}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="palette" className="m-0 flex-1 overflow-hidden">
                    <div className="border-b px-3 py-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={paletteQuery}
                                onChange={(e) => setPaletteQuery(e.target.value)}
                                placeholder="Search components…"
                                className="h-8 pl-7 text-[12px]"
                            />
                        </div>
                        {!selectedScreenId ? (
                            <p className="mt-2 text-[10.5px] text-destructive">
                                Select a screen first to add components.
                            </p>
                        ) : (
                            <p className="mt-2 text-[10.5px] text-muted-foreground">
                                Adding to <span className="font-mono">{selectedScreenId}</span>
                            </p>
                        )}
                    </div>

                    <ScrollArea className="h-[calc(100%-4.5rem)] px-2 py-2">
                        {filteredPalette.map((group) => (
                            <div key={group.name} className="mb-3">
                                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {group.name}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {group.components.map((c) => {
                                        const Icon = c.icon;
                                        return (
                                            <button
                                                key={c.type}
                                                type="button"
                                                disabled={!selectedScreenId}
                                                onClick={() => { if (selectedScreenId) onAddComponent(selectedScreenId, c.type); }}
                                                title={c.description}
                                                className={cn(
                                                    "group flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors",
                                                    "bg-background hover:border-primary hover:bg-primary/5",
                                                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-background",
                                                )}
                                            >
                                                <div className="flex w-full items-center justify-between">
                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                                                    <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                </div>
                                                <span className="text-[11.5px] font-semibold leading-tight">{c.label}</span>
                                                <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{c.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {filteredPalette.length === 0 ? (
                            <div className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                                No components match "{paletteQuery}".
                            </div>
                        ) : null}
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
