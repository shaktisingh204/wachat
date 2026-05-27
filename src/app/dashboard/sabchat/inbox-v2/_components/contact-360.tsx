import { Badge, Button, Separator } from "@/components/zoruui";
import { SabChatConversation } from "@/lib/rust-client/sabchat";

export function Contact360({ selected }: { selected: SabChatConversation | undefined }) {
    if (!selected) {
        return (
            <aside className="col-span-3 overflow-y-auto rounded border bg-zoru-surface p-3 flex items-center justify-center text-sm text-zoru-ink-muted">
                Select a conversation to view details.
            </aside>
        );
    }

    return (
        <aside className="col-span-3 overflow-y-auto rounded border bg-zoru-surface p-4 space-y-6">
            <div>
                <h3 className="text-sm font-semibold mb-2">Contact 360</h3>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zoru-ink/10 flex items-center justify-center text-zoru-ink font-bold">
                        {selected.contactId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div className="text-sm font-medium">{selected.contactId.slice(-6)}</div>
                        <div className="text-xs text-zoru-ink-muted">Customer</div>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <div className="text-xs font-semibold uppercase text-zoru-ink-muted mb-2">
                    CRM Records
                </div>
                <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Company</span>
                        <span className="font-medium">Acme Corp</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">ARR</span>
                        <span className="font-medium">$120,000</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Tier</span>
                        <Badge variant="secondary" className="text-[10px]">Enterprise</Badge>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <div className="text-xs font-semibold uppercase text-zoru-ink-muted mb-2">
                    Deal History
                </div>
                <div className="text-sm space-y-3">
                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-zoru-ink mt-1.5" />
                        <div>
                            <div className="font-medium">Upsell Q3 (Won)</div>
                            <div className="text-xs text-zoru-ink-muted">Sep 15, 2023 &bull; $15k</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-zoru-ink mt-1.5" />
                        <div>
                            <div className="font-medium">Renewal (Open)</div>
                            <div className="text-xs text-zoru-ink-muted">Expected Dec 1, 2023 &bull; $120k</div>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <div className="text-xs font-semibold uppercase text-zoru-ink-muted mb-2">
                    Ad Attribution
                </div>
                <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Source</span>
                        <span className="font-medium">Google Ads</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Campaign</span>
                        <span className="font-medium">Q4_Enterprise_Search</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Term</span>
                        <span className="font-medium truncate max-w-[100px]" title="omnichannel inbox">omnichannel...</span>
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <div className="text-xs font-semibold uppercase text-zoru-ink-muted mb-2">
                    SLA & Assignment
                </div>
                <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-zoru-ink-muted">SLA</span>
                        {selected.sla?.breached ? (
                            <Badge variant="destructive" className="text-[10px]">Breached</Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px]">On track</Badge>
                        )}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-zoru-ink-muted">Assignee</span>
                        <span className="font-medium">{selected.assigneeId ?? 'Unassigned'}</span>
                    </div>
                </div>
            </div>

            {selected.customAttrs && Object.keys(selected.customAttrs).length > 0 && (
                <>
                    <Separator />
                    <div>
                        <div className="text-xs font-semibold uppercase text-zoru-ink-muted mb-2">
                            Custom Attributes
                        </div>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-zoru-surface-2 p-2 text-[10px]">
                            {JSON.stringify(selected.customAttrs, null, 2)}
                        </pre>
                    </div>
                </>
            )}
        </aside>
    );
}
