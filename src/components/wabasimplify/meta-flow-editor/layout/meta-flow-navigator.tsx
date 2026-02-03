
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronRight, FileJson, Layers, Layout, Plus, Trash2 } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface MetaFlowNavigatorProps {
    screens: any[];
    selectedScreenId: string | null;
    onSelectScreen: (screenId: string) => void;
    onAddScreen: () => void;
    onDeleteScreen: (screenId: string) => void;
    selectedComponent: any | null;
    onSelectComponent: (component: any) => void;
    onDeleteComponent: (componentName: string) => void;
}

export function MetaFlowNavigator({
    screens,
    selectedScreenId,
    onSelectScreen,
    onAddScreen,
    onDeleteScreen,
    selectedComponent,
    onSelectComponent,
    onDeleteComponent
}: MetaFlowNavigatorProps) {

    return (
        <div className="flex flex-col h-full border-r bg-muted/10">
            <div className="p-4 border-b flex items-center justify-between bg-background">
                <span className="font-semibold text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Navigator
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddScreen}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                    <Accordion type="single" collapsible className="w-full" value={selectedScreenId || undefined}>
                        {screens.map((screen) => (
                            <AccordionItem value={screen.id} key={screen.id} className="border-b-0 mb-1">
                                <div className={cn(
                                    "flex items-center group rounded-md transition-colors",
                                    selectedScreenId === screen.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                                )}>
                                    <AccordionTrigger
                                        onClick={() => onSelectScreen(screen.id)}
                                        className="py-2 px-3 hover:no-underline flex-1 text-sm pt-2 pb-2"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Layout className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                            <span className="truncate">{screen.title || screen.id}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteScreen(screen.id);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>

                                <AccordionContent className="pl-4 pr-1 pt-1 pb-2">
                                    <div className="space-y-0.5 border-l px-2">
                                        {(screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList')?.children || []).map((comp: any, idx: number) => (
                                            <div
                                                key={comp.name || idx}
                                                className={cn(
                                                    "flex items-center justify-between px-2 py-1.5 rounded-sm text-xs cursor-pointer group transition-colors",
                                                    selectedComponent?.name === comp.name
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "hover:bg-muted text-muted-foreground"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectScreen(screen.id); // Ensure screen is selected too
                                                    onSelectComponent(comp);
                                                }}
                                            >
                                                <span className="truncate flex-1">{comp.label || comp.text || comp.type}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 -mr-1 hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteComponent(comp.name);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(!screen.layout.children.find((c: any) => c.type === 'Form' || c.type === 'NavigationList')?.children?.length) && (
                                            <div className="px-2 py-1 text-xs text-muted-foreground/50 italic">No components</div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    {screens.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <p>No screens yet.</p>
                            <Button variant="link" size="sm" onClick={onAddScreen} className="mt-2 text-primary">Add your first screen</Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
