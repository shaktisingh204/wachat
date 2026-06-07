"use client";

import { useMemo, useState } from "react";
import {
    BadgeX, ChevronRight, Layers, Layout, Plus, Search, Trash2, MoreHorizontal,
    MousePointerClick, Copy,
} from "lucide-react";
import {
    cn, Button, IconButton, Input, Badge, EmptyState, ScrollArea,
    Tabs, TabsContent, TabsList, TabsTrigger,
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/sabcrm/20ui';
import { declarativeFlowComponents } from "@/components/20ui-domain/meta-flow-templates";

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
        <div className="flex h-full flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-muted)]/10">
            <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                    <Layers className="h-4 w-4" aria-hidden="true" /> Flow builder
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
                        <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                            {screens.length} screen{screens.length === 1 ? '' : 's'}
                        </span>
                        <IconButton
                            label="Add screen"
                            icon={Plus}
                            size="sm"
                            className="h-7 w-7"
                            onClick={onAddScreen}
                        />
                    </div>
                    <ScrollArea className="h-[calc(100%-2.5rem)] px-2">
                        <Accordion type="single" collapsible className="w-full" value={selectedScreenId || undefined}>
                            {screens.map((screen) => {
                                const comps = flattenLayoutChildren(screen);
                                return (
                                    <AccordionItem value={screen.id} key={screen.id} className="mb-1 border-b-0">
                                        <div className={cn(
                                            "group flex items-center rounded-[var(--st-radius)] pr-1 transition-colors",
                                            selectedScreenId === screen.id ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]" : "hover:bg-[var(--st-bg-muted)]",
                                        )}>
                                            <AccordionTrigger
                                                hideChevron
                                                onClick={() => onSelectScreen(screen.id)}
                                                className="flex-1 px-3 py-2 text-sm hover:no-underline"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Layout className="h-3 w-3 flex-shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                                    <span className="truncate">{screen.title || screen.id}</span>
                                                    {screen.terminal ? (
                                                        <Badge tone="neutral" kind="soft" className="ml-1 text-[9px] uppercase">
                                                            terminal
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                            </AccordionTrigger>

                                            <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <IconButton
                                                            label="Screen actions"
                                                            icon={MoreHorizontal}
                                                            size="sm"
                                                            className="h-6 w-6"
                                                        />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-52">
                                                        <DropdownMenuLabel>Screen actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem iconLeft={Plus} onClick={() => { onSelectScreen(screen.id); setTab('palette'); }}>
                                                            Add component
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem iconLeft={Copy} onClick={() => navigator.clipboard?.writeText(screen.id)}>
                                                            Copy screen ID
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                <IconButton
                                                    label="Delete screen"
                                                    icon={BadgeX}
                                                    size="sm"
                                                    className="h-6 w-6 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteScreen(screen.id); }}
                                                />
                                            </div>
                                        </div>

                                        <AccordionContent className="pb-2 pl-4 pr-1 pt-1">
                                            <div className="space-y-0.5 border-l border-[var(--st-border)] px-2">
                                                {comps.length === 0 ? (
                                                    <p className="px-2 py-2 text-[11px] italic text-[var(--st-text-secondary)]/60">
                                                        No components. Open the Components tab to add.
                                                    </p>
                                                ) : comps.map((comp: any, idx: number) => (
                                                    <div
                                                        key={(comp.name || comp._id || `${comp.type}-${idx}`) + idx}
                                                        className={cn(
                                                            "group/row flex cursor-pointer items-center justify-between rounded-[var(--st-radius)] px-2 py-1.5 text-xs transition-colors",
                                                            (selectedComponent === comp || (selectedComponent?.name && selectedComponent.name === comp.name))
                                                                ? "bg-[var(--st-text)]/10 font-medium text-[var(--st-text)]"
                                                                : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]",
                                                        )}
                                                        onClick={(e) => { e.stopPropagation(); onSelectScreen(screen.id); onSelectComponent(comp); }}
                                                    >
                                                        <span className="flex flex-1 items-center gap-2 truncate">
                                                            {comp.type === 'Footer'
                                                                ? <MousePointerClick className="h-3 w-3" aria-hidden="true" />
                                                                : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                                                            <span className="truncate">{comp.label || comp.text || comp.name || comp.type}</span>
                                                            <Badge tone="neutral" kind="soft" className="ml-auto shrink-0 font-mono text-[9px]">
                                                                {comp.type}
                                                            </Badge>
                                                        </span>
                                                        <IconButton
                                                            label="Delete component"
                                                            icon={Trash2}
                                                            size="sm"
                                                            className="-mr-1 h-5 w-5 opacity-0 hover:bg-[var(--st-text)]/10 hover:text-[var(--st-text)] group-hover/row:opacity-100"
                                                            onClick={(e) => { e.stopPropagation(); onDeleteComponent(comp.name || comp); }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>

                        {screens.length === 0 ? (
                            <EmptyState
                                icon={Layout}
                                title="No screens yet"
                                description="Add your first screen to start building the flow."
                                action={(
                                    <Button variant="primary" size="sm" iconLeft={Plus} onClick={onAddScreen}>
                                        Add screen
                                    </Button>
                                )}
                                size="sm"
                                className="py-8"
                            />
                        ) : null}
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="palette" className="m-0 flex-1 overflow-hidden">
                    <div className="border-b border-[var(--st-border)] px-3 py-2">
                        <Input
                            value={paletteQuery}
                            onChange={(e) => setPaletteQuery(e.target.value)}
                            placeholder="Search components..."
                            iconLeft={Search}
                            inputSize="sm"
                            aria-label="Search components"
                        />
                        {!selectedScreenId ? (
                            <p className="mt-2 text-[10.5px] text-[var(--st-text)]">
                                Select a screen first to add components.
                            </p>
                        ) : (
                            <p className="mt-2 text-[10.5px] text-[var(--st-text-secondary)]">
                                Adding to <span className="font-mono">{selectedScreenId}</span>
                            </p>
                        )}
                    </div>

                    <ScrollArea className="h-[calc(100%-4.5rem)] px-2 py-2">
                        {filteredPalette.map((group) => (
                            <div key={group.name} className="mb-3">
                                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    {group.name}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {group.components.map((c) => {
                                        const Icon = c.icon;
                                        return (
                                            <Button
                                                key={c.type}
                                                variant="ghost"
                                                disabled={!selectedScreenId}
                                                onClick={() => { if (selectedScreenId) onAddComponent(selectedScreenId, c.type); }}
                                                title={c.description}
                                                aria-label={`Add ${c.label}`}
                                                className={cn(
                                                    "group flex h-auto flex-col items-start gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-left transition-colors",
                                                    "bg-[var(--st-bg-secondary)] hover:border-[var(--st-accent)] hover:bg-[var(--st-text)]/5",
                                                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--st-border)] disabled:hover:bg-[var(--st-bg-secondary)]",
                                                )}
                                            >
                                                <span className="flex w-full flex-col items-start gap-1">
                                                    <span className="flex w-full items-center justify-between">
                                                        <Icon className="h-3.5 w-3.5 text-[var(--st-text-secondary)] group-hover:text-[var(--st-text)]" aria-hidden="true" />
                                                        <Plus className="h-3 w-3 text-[var(--st-text-secondary)] opacity-0 group-hover:opacity-100" aria-hidden="true" />
                                                    </span>
                                                    <span className="text-[11.5px] font-semibold leading-tight text-[var(--st-text)]">{c.label}</span>
                                                    <span className="line-clamp-2 text-[10px] font-normal leading-snug text-[var(--st-text-secondary)]">{c.description}</span>
                                                </span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {filteredPalette.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="No matching components"
                                description={`No components match "${paletteQuery}".`}
                                size="sm"
                                className="py-6"
                            />
                        ) : null}
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
