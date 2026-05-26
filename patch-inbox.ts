import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/sabchat/inbox-v2/_components/inbox-v2-client.tsx', 'utf-8');

// 1. imports
content = content.replace(
    "import { Button, Input, Badge } from '@/components/zoruui';",
    `import { Button, Input, Badge, ZoruDropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/zoruui';\nimport { CommandPalette } from './command-palette';\nimport { Contact360 } from './contact-360';\nimport { ChevronDown, X } from 'lucide-react';`
);

// 2. state for tabs
content = content.replace(
    "const [selectedId, setSelectedId] = useState<string | undefined>(",
    `const [activeTabs, setActiveTabs] = useState<string[]>(initialSelectedConversationId ? [initialSelectedConversationId] : (initialConversations[0] ? [initialConversations[0]._id] : []));\n    const [selectedId, setSelectedId] = useState<string | undefined>(`
);

// 3. effect for tabs
content = content.replace(
    "const selected = useMemo(",
    `useEffect(() => {\n        if (selectedId && !activeTabs.includes(selectedId)) {\n            setActiveTabs(prev => [...prev, selectedId]);\n        }\n    }, [selectedId, activeTabs]);\n\n    const selected = useMemo(`
);

// 4. Update the onClick in conversation list to only set selectedId (the effect handles adding to tabs)
content = content.replace(
    /onClick=\{\(\) => \{\n\s+setSelectedId\(c._id\);\n\s+updateUrl\(\{ selected: c._id \}\);\n\s+\}\}/g,
    `onClick={() => {\n                                    setSelectedId(c._id);\n                                    updateUrl({ selected: c._id });\n                                }}`
);

// 5. Contact360 replacement
content = content.replace(
    /<aside className="col-span-2 overflow-y-auto rounded border bg-card p-3">[\s\S]*?<\/aside>/,
    `<Contact360 selected={selected} />`
);
content = content.replace(
    /<main className="col-span-5 flex flex-col rounded border bg-card">[\s\S]*?<\/main>/,
    `<!--MAIN_REPLACE-->`
);

let mainContent = `<main className="col-span-5 flex flex-col rounded border bg-card overflow-hidden">
                {/* Tabs Bar */}
                {activeTabs.length > 0 && (
                    <div className="flex bg-muted/50 border-b overflow-x-auto">
                        {activeTabs.map(tabId => {
                            const tConv = conversations.find(c => c._id === tabId);
                            const title = tConv ? (tConv.lastMessagePreview ? tConv.lastMessagePreview.slice(0, 15) + '...' : \`Conv \${tabId.slice(-6)}\`) : tabId.slice(-6);
                            return (
                                <div
                                    key={tabId}
                                    className={\`group flex items-center gap-2 px-3 py-2 text-sm border-r cursor-pointer \${selectedId === tabId ? 'bg-card font-medium border-b-2 border-b-primary' : 'hover:bg-accent'}\`}
                                    onClick={() => { setSelectedId(tabId); updateUrl({ selected: tabId }); }}
                                >
                                    <span>{title}</span>
                                    <button
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-muted"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newTabs = activeTabs.filter(id => id !== tabId);
                                            setActiveTabs(newTabs);
                                            if (selectedId === tabId) {
                                                const next = newTabs[newTabs.length - 1];
                                                setSelectedId(next);
                                                updateUrl({ selected: next });
                                            }
                                        }}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {selected ? (
                    <>
                        <header className="flex items-center justify-between border-b p-3">
                            <div className="text-sm font-semibold">
                                Conversation {selected._id.slice(-6)}
                                <Badge variant="secondary" className="ml-2 capitalize">
                                    {selected.status}
                                </Badge>
                            </div>
                            <div className="flex gap-1 items-center">
                                <ZoruDropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline">
                                            Actions <ChevronDown className="w-4 h-4 ml-1" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Collaboration</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Followed' })}>
                                            Follow
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Swarm initiated' })}>
                                            Swarm
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Routing</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => toast({ title: 'Handoff requested' })}>
                                            Handoff
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={onAssign} disabled={isPending}>
                                            Auto-assign
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </ZoruDropdownMenu>

                                <Button size="sm" variant="ghost" onClick={onSnooze} disabled={isPending}>
                                    Snooze
                                </Button>
                                {selected.status === 'resolved' ? (
                                    <Button size="sm" onClick={onReopen} disabled={isPending}>
                                        Reopen
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={onResolve} disabled={isPending}>
                                        Resolve
                                    </Button>
                                )}
                            </div>
                        </header>
                        <div className="flex-1 space-y-2 overflow-y-auto p-3">
                            {messages.map((m) => (
                                <div
                                    key={m._id}
                                    className={\`flex \${
                                        m.direction === 'outbound' ? 'justify-end' : 'justify-start'
                                    }\`}
                                >
                                    <div
                                        className={\`max-w-[70%] rounded-lg px-3 py-2 text-sm \${
                                            m.direction === 'outbound'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                        } \${m.private ? 'border-2 border-dashed border-amber-500' : ''}\`}
                                    >
                                        {renderContent(m.content)}
                                        <div className="mt-1 text-[10px] opacity-70">
                                            {new Date(m.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 ? (
                                <div className="py-8 text-center text-xs text-muted-foreground">
                                    No messages yet.
                                </div>
                            ) : null}
                        </div>
                        <footer className="border-t p-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Type a reply... (Cmd+K for Command Palette)"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            onSend();
                                        }
                                    }}
                                />
                                <Button onClick={onSend} disabled={isPending || !draft.trim()}>
                                    Send
                                </Button>
                            </div>
                        </footer>
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        Pick a conversation.
                    </div>
                )}
            </main>`;

content = content.replace("<!--MAIN_REPLACE-->", mainContent);

// Add CommandPalette at the end of the return statement before the closing div
content = content.replace(
    /<Contact360 selected=\{selected\} \/>\n\s*<\/div>/,
    `<Contact360 selected={selected} />\n            <CommandPalette\n                conversations={conversations}\n                selectedId={selectedId}\n                onSelect={(id) => { setSelectedId(id); updateUrl({ selected: id }); }}\n                onAssign={onAssign}\n                onResolve={onResolve}\n                onSnooze={onSnooze}\n            />\n        </div>`
);

fs.writeFileSync('src/app/dashboard/sabchat/inbox-v2/_components/inbox-v2-client.tsx', content);
console.log("Patched inbox-v2-client.tsx");
