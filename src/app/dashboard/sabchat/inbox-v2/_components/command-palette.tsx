"use client";

import { useEffect, useState } from "react";
import {
    ZoruCommandDialog,
    ZoruCommandInput,
    ZoruCommandList,
    ZoruCommandEmpty,
    ZoruCommandGroup,
    ZoruCommandItem,
    ZoruCommandShortcut
} from "@/components/sabcrm/20ui/zoru";
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
        <ZoruCommandDialog open={open} onOpenChange={setOpen}>
            <ZoruCommandInput placeholder="Type a command or search..." />
            <ZoruCommandList>
                <ZoruCommandEmpty>No results found.</ZoruCommandEmpty>
                <ZoruCommandGroup heading="Actions">
                    <ZoruCommandItem
                        onSelect={() => {
                            if (selectedId) onAssign(selectedId);
                            setOpen(false);
                        }}
                    >
                        Auto-assign Current Conversation
                        <ZoruCommandShortcut>⌘E</ZoruCommandShortcut>
                    </ZoruCommandItem>
                    <ZoruCommandItem
                        onSelect={() => {
                            if (selectedId) onResolve(selectedId);
                            setOpen(false);
                        }}
                    >
                        Resolve Current Conversation
                    </ZoruCommandItem>
                    <ZoruCommandItem
                        onSelect={() => {
                            if (selectedId) onSnooze(selectedId);
                            setOpen(false);
                        }}
                    >
                        Snooze Current Conversation
                    </ZoruCommandItem>
                </ZoruCommandGroup>
                <ZoruCommandGroup heading="Conversations">
                    {conversations.map((c) => (
                        <ZoruCommandItem
                            key={c._id}
                            onSelect={() => {
                                onSelect(c._id);
                                setOpen(false);
                            }}
                        >
                            {c.lastMessagePreview || `Conversation ${c._id.slice(-6)}`}
                        </ZoruCommandItem>
                    ))}
                </ZoruCommandGroup>
            </ZoruCommandList>
        </ZoruCommandDialog>
    );
}
