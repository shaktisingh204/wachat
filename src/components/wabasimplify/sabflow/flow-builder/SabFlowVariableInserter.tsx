import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sparkles, ChevronRight, Variable } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SabFlowVariable {
    id: string;
    label: string;
    value: string; // The syntax to insert, e.g. {{trigger.phone}}
    group: string; // Node label or "System"
}

interface SabFlowVariableInserterProps {
    onInsert: (variable: string) => void;
    availableVariables: SabFlowVariable[];
    className?: string;
}

export function SabFlowVariableInserter({ onInsert, availableVariables, className }: SabFlowVariableInserterProps) {
    const [open, setOpen] = useState(false);

    // Group variables by their group (Node Name)
    const groupedVariables = availableVariables.reduce((acc, text) => {
        const group = text.group;
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(text);
        return acc;
    }, {} as Record<string, SabFlowVariable[]>);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6 text-muted-foreground hover:text-primary transition-colors", className)}
                    title="Insert Variable"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="sr-only">Insert Variable</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
                <Command>
                    <CommandInput placeholder="Search variables..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No variables found.</CommandEmpty>
                        <ScrollArea className="h-64">
                            {Object.entries(groupedVariables).map(([group, vars]) => (
                                <CommandGroup key={group} heading={group}>
                                    {vars.map((variable) => (
                                        <CommandItem
                                            key={variable.id}
                                            value={`${variable.group} ${variable.label}`}
                                            onSelect={() => {
                                                onInsert(variable.value);
                                                setOpen(false);
                                            }}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Variable className="h-3 w-3 text-muted-foreground opacity-70" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium leading-none">{variable.label}</span>
                                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{variable.value}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))}
                        </ScrollArea>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
