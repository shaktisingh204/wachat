const fs = require('fs');
const file = 'src/app/dashboard/crm/notifications/_components/notifications-client.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { Bell, Check, CheckCheck, Clock, Inbox, AlertTriangle, MessageSquare, Briefcase, ExternalLink } from 'lucide-react';",
  "import { Bell, Check, CheckCheck, Clock, Inbox, AlertTriangle, MessageSquare, Briefcase, ExternalLink, Settings } from 'lucide-react';\nimport { Modal } from '@/components/zoruui';"
);

code = code.replace(
  "const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');",
  "const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');\n    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);"
);

code = code.replace(
  "    return (\n        <EntityListShell",
  `    return (
        <>
            <Modal open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <div className="p-6">
                    <h2 className="text-lg font-medium mb-4">Notification Settings</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Email Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Push Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Mentions Only</span>
                            <input type="checkbox" className="toggle" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setIsSettingsOpen(false)}>Save</Button>
                    </div>
                </div>
            </Modal>
        <EntityListShell`
);

code = code.replace(
  /<Button\s+variant="ghost"\s+onClick=\{handleMarkAll\}\s+disabled=\{pending \|\| kpis\.unread === 0\}\s*>\s*<CheckCheck className="h-4 w-4" \/>\s*Mark all read\s*<\/Button>/g,
  `<div className="flex gap-2">
                <Button
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
                >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                </Button>
                </div>`
);

// We need to replace `{filtered.map((row) => {` and the surrounding card/ul
// And `})}` and the surrounding `</ul></Card>`
const topOld = `                {filtered.length > 0 ? (
                    <Card className="p-0">
                        <ul className="divide-y divide-zoru-line">
                            {filtered.map((row) => {`;
const topNew = `                {filtered.length > 0 ? (
                    <div className="flex flex-col gap-6">
                        {(() => {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                            
                            const groups: Record<string, typeof filtered> = {
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
                                            {items.map((row) => {`;
code = code.replace(topOld, topNew);

const bottomOld = `                                );
                            })}
                        </ul>
                    </Card>
                ) : null}`;
const bottomNew = `                                );
                                            })}
                                        </ul>
                                    </Card>
                                </div>
                            ));
                        })()}
                    </div>
                ) : null}`;
code = code.replace(bottomOld, bottomNew);

code = code.replace(
  "        </EntityListShell>\n    );\n}",
  "        </EntityListShell>\n        </>\n    );\n}"
);

fs.writeFileSync(file, code);
