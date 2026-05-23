import re

with open('src/app/dashboard/crm/notifications/_components/notifications-client.tsx', 'r') as f:
    code = f.read()

# Add Settings button to primaryAction
settings_button = """<Button
                    variant="ghost"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <Settings className="h-4 w-4" />
                    Settings
                </Button>"""

# We need to add Settings icon to import
code = code.replace("import { Bell, Check, CheckCheck, Clock, Inbox, AlertTriangle, MessageSquare, Briefcase, ExternalLink } from 'lucide-react';",
                    "import { Bell, Check, CheckCheck, Clock, Inbox, AlertTriangle, MessageSquare, Briefcase, ExternalLink, Settings } from 'lucide-react';\nimport { Modal } from '@/components/zoruui';")


# Add state
code = code.replace("const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');",
                    "const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');\n    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);")

# Add Settings modal to return
modal_code = """
            <Modal open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <div className="p-6">
                    <h2 className="text-lg font-medium mb-4">Notification Settings</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span>Email Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Push Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Mentions Only</span>
                            <input type="checkbox" className="toggle" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setIsSettingsOpen(false)}>Save</Button>
                    </div>
                </div>
            </Modal>
"""

code = code.replace("<EntityListShell", f"{modal_code}\n        <EntityListShell")

code = code.replace("""<Button
                    variant="ghost"
                    onClick={handleMarkAll}
                    disabled={pending || kpis.unread === 0}
                >""", """<div className="flex gap-2"><Button
                    variant="ghost"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleMarkAll}
                    disabled={pending || kpis.unread === 0}
                >""")
code = code.replace("Mark all read\n                </Button>", "Mark all read\n                </Button></div>")

# Change how rows are rendered: group by day/week.
# We will just replace the `filtered.map` part
render_code = """
                        <div className="flex flex-col gap-6">
                            {(() => {
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                
                                const groups = {
                                    'Today': [],
                                    'This Week': [],
                                    'Older': []
                                };
                                
                                filtered.forEach(row => {
                                    const ts = new Date(row.ts);
                                    if (ts >= today) groups['Today'].push(row);
                                    else if (ts >= weekAgo) groups['This Week'].push(row);
                                    else groups['Older'].push(row);
                                });
                                
                                return Object.entries(groups).filter(([_, items]) => items.length > 0).map(([label, items]) => (
                                    <div key={label}>
                                        <h4 className="text-sm font-medium text-muted-foreground mb-2 px-2">{label}</h4>
                                        <Card className="p-0">
                                            <ul className="divide-y divide-zoru-line">
                                                {items.map((row) => {
                                                    const Icon = KIND_ICON[row.kind] ?? Bell;
                                                    return (
                                                        <li
                                                            key={row._id}
                                                            className={cn(
                                                                'flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between',
                                                                !row.read && 'bg-zoru-warning-bg/20',
                                                            )}
                                                        >
                                                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                                                <Icon className="mt-1 h-4 w-4 shrink-0 text-zoru-ink-muted" />
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Badge variant="secondary">
                                                                            {row.entityKind}
                                                                        </Badge>
                                                                        <Badge variant="secondary">
                                                                            {row.kind}
                                                                        </Badge>
                                                                        <p className="text-[13px] text-zoru-ink">
                                                                            <span className="font-medium">
                                                                                {actorLabel(row.actorId, row.actorIsYou)}
                                                                            </span>{' '}
                                                                            {verbFor(row.action)}{' '}
                                                                            <span className="font-medium">
                                                                                {row.entityKind} {row.entityId.slice(-6)}
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                    {row.reason ? (
                                                                        <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                                                                            {row.reason}
                                                                        </p>
                                                                    ) : null}
                                                                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                                                                        {relative(row.ts)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex shrink-0 items-center gap-1">
                                                                {row.entityHref ? (
                                                                    <Button asChild variant="ghost" size="sm">
                                                                        <Link href={row.entityHref}>
                                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                                            Open
                                                                        </Link>
                                                                    </Button>
                                                                ) : null}
                                                                {!row.read ? (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleMarkOne(row._id)}
                                                                        disabled={pending}
                                                                    >
                                                                        <Check className="h-3.5 w-3.5" />
                                                                        Read
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </Card>
                                    </div>
                                ));
                            })()}
                        </div>
"""

code = code.replace("""<Card className="p-0">
                        <ul className="divide-y divide-zoru-line">
                            {filtered.map((row) => {""", "MARKER_START")

# This relies on the fact that `})}` and `</ul>` and `</Card>` are at the end.
# I'll just use regex.
import re
code = re.sub(r'<Card className="p-0">\s*<ul className="divide-y divide-zoru-line">.*?</ul>\s*</Card>', render_code.replace('\\', '\\\\'), code, flags=re.DOTALL)

with open('src/app/dashboard/crm/notifications/_components/notifications-client.tsx', 'w') as f:
    f.write(code)

