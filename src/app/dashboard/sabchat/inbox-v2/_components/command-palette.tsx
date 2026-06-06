"use client";

import { useEffect, useState } from "react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/sabcrm/20ui/compat';
import { SabChatConversation } from "@/lib/rust-client/sabchat";

interface CommandPaletteProps {
    conversations: SabChatConversation[];
    selectedId?: string;
    onSelect: (id: string) => void;
    onAssign: (id: string) => void;
    onResolve: (id: string) => void;
    onSnooze: (id: string) => void;
}

export function CommandPalette({
    conversations,
    selectedId,
    onSelect,
    onAssign,
    onResolve,
    onSnooze,
}: CommandPaletteProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
            if (e.key === "e" && (e.metaKey || e.ctrlKey) && selectedId) {
                e.preventDefault();
                onAssign(selectedId);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [selectedId, onAssign]);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Actions">
                    <CommandItem
                        onSelect={() => {
                            if (selectedId) onAssign(selectedId);
                            setOpen(false);
                        }}
                    >
                        Auto-assign Current Conversation
                        <CommandShortcut>⌘E</CommandShortcut>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => {
                            if (selectedId) onResolve(selectedId);
                            setOpen(false);
                        }}
                    >
                        Resolve Current Conversation
                    </CommandItem>
                    <CommandItem
                        onSelect={() => {
                            if (selectedId) onSnooze(selectedId);
                            setOpen(false);
                        }}
                    >
                        Snooze Current Conversation
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Conversations">
                    {conversations.map((c) => (
                        <CommandItem
                            key={c._id}
                            onSelect={() => {
                                onSelect(c._id);
                                setOpen(false);
                            }}
                        >
                            {c.lastMessagePreview || `Conversation ${c._id.slice(-6)}`}
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
