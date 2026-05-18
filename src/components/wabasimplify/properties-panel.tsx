
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruScrollArea } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';
import { Trash2, Settings2, Plus, Variable, ChevronDown } from 'lucide-react';
import { ALL_BLOCK_TYPES } from '@/components/flow-builder/Sidebar';
import { useProject } from '@/context/project-context';
import { cn } from '@/lib/utils';
import { SabFileUrlInput, type SabFileAccept } from '@/components/sabfiles';

/* ── Dynamic selector for variables ─────────────────── */

function VariableInserter({ onInsert }: { onInsert: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const vars = [
        { key: '{{name}}', label: 'Contact Name' },
        { key: '{{waId}}', label: 'Phone Number' },
        { key: '{{last_input}}', label: 'Last User ZoruInput' },
        { key: '{{cart_summary}}', label: 'Cart Summary' },
        { key: '{{custom.', label: 'Custom Variable...' },
    ];
    if (!open) return (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
            <Variable className="h-3 w-3" /> Insert variable
        </button>
    );
    return (
        <div className="rounded-md border bg-muted/30 p-2 space-y-1">
            {vars.map(v => (
                <button key={v.key} type="button" onClick={() => { onInsert(v.key); setOpen(false); }}
                    className="block w-full text-left text-[11px] px-2 py-1 rounded hover:bg-accent truncate">
                    <code className="text-primary">{v.key}</code> <span className="text-muted-foreground ml-1">{v.label}</span>
                </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground ml-2">Close</button>
        </div>
    );
}

/* ── Reusable editor field ──────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <ZoruLabel className="text-xs">{label}</ZoruLabel>
            {children}
            {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

/* ── Node-specific editors ──────────────────────────── */

function TextNodeEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Message Text">
                <ZoruTextarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="Hello {{name}}! How can I help you today?" className="min-h-[100px] text-sm" />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </Field>
            <Field label="Preview URL" hint="If enabled, URLs in the message will show a link preview">
                <ZoruSelect value={data.previewUrl || 'true'} onValueChange={v => onChange({ previewUrl: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="true">Enabled</ZoruSelectItem>
                        <ZoruSelectItem value="false">Disabled</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
        </>
    );
}

function MediaNodeEditor({ data, onChange, mediaType }: { data: any; onChange: (d: any) => void; mediaType: string }) {
    const accept: SabFileAccept =
        mediaType === 'image' || mediaType === 'sticker' ? 'image'
        : mediaType === 'video' ? 'video'
        : mediaType === 'audio' ? 'audio'
        : mediaType === 'document' ? 'document'
        : 'all';
    return (
        <>
            <Field label={`${mediaType} URL`}>
                <SabFileUrlInput
                    value={data.mediaUrl || ''}
                    onChange={(v) => onChange({ mediaUrl: v })}
                    accept={accept}
                    placeholder="https://example.com/media.jpg"
                />
            </Field>
            <Field label="Or Base64 Data" hint="Paste a base64 data URI">
                <ZoruInput value={data.imageBase64 || ''} onChange={e => onChange({ imageBase64: e.target.value })} placeholder="data:image/png;base64,..." />
            </Field>
            {mediaType !== 'sticker' && mediaType !== 'audio' && (
                <Field label="Caption">
                    <ZoruTextarea value={data.caption || ''} onChange={e => onChange({ caption: e.target.value })} placeholder="Optional caption" rows={2} />
                    <VariableInserter onInsert={v => onChange({ caption: (data.caption || '') + v })} />
                </Field>
            )}
            {mediaType === 'document' && (
                <Field label="Filename">
                    <ZoruInput value={data.filename || ''} onChange={e => onChange({ filename: e.target.value })} placeholder="report.pdf" />
                </Field>
            )}
        </>
    );
}

function ButtonsNodeEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const buttons: any[] = data.buttons || [];
    const addBtn = () => onChange({ buttons: [...buttons, { text: '', type: 'reply' }] });
    const removeBtn = (i: number) => onChange({ buttons: buttons.filter((_: any, idx: number) => idx !== i) });
    const updateBtn = (i: number, field: string, value: string) => {
        const updated = [...buttons];
        updated[i] = { ...updated[i], [field]: value };
        onChange({ buttons: updated });
    };

    return (
        <>
            <Field label="Message Body">
                <ZoruTextarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="What would you like to do?" rows={3} />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </Field>
            <Field label="Header (Optional)">
                <ZoruInput value={data.header || ''} onChange={e => onChange({ header: e.target.value })} placeholder="Choose an option" />
            </Field>
            <Field label="Footer (Optional)">
                <ZoruInput value={data.footer || ''} onChange={e => onChange({ footer: e.target.value })} />
            </Field>
            <div className="space-y-2">
                <ZoruLabel className="text-xs">Buttons ({buttons.length}/3)</ZoruLabel>
                {buttons.map((btn: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                        <ZoruInput value={btn.text || ''} onChange={e => updateBtn(i, 'text', e.target.value)} placeholder={`ZoruButton ${i + 1}`} className="flex-1 text-sm" />
                        <ZoruButton type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBtn(i)}><Trash2 className="h-3 w-3" /></ZoruButton>
                    </div>
                ))}
                {buttons.length < 3 && (
                    <ZoruButton type="button" variant="outline" size="sm" onClick={addBtn} className="w-full"><Plus className="h-3 w-3 mr-1" /> Add ZoruButton</ZoruButton>
                )}
            </div>
        </>
    );
}

function ListMessageEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const sections: any[] = data.sections || [{ title: 'Options', rows: [{ id: '1', title: '' }] }];

    const updateSection = (si: number, field: string, value: any) => {
        const updated = [...sections];
        updated[si] = { ...updated[si], [field]: value };
        onChange({ sections: updated });
    };
    const addRow = (si: number) => {
        const updated = [...sections];
        updated[si].rows = [...(updated[si].rows || []), { id: String(Date.now()), title: '' }];
        onChange({ sections: updated });
    };

    return (
        <>
            <Field label="Body Text">
                <ZoruTextarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="Choose from the options below" rows={2} />
            </Field>
            <Field label="ZoruButton Text" hint="Text shown on the list menu button">
                <ZoruInput value={data.buttonText || ''} onChange={e => onChange({ buttonText: e.target.value })} placeholder="View Options" />
            </Field>
            <Field label="Header (Optional)">
                <ZoruInput value={data.header || ''} onChange={e => onChange({ header: e.target.value })} />
            </Field>
            <div className="space-y-3">
                {sections.map((section: any, si: number) => (
                    <div key={si} className="border rounded-md p-2 space-y-2">
                        <ZoruInput value={section.title || ''} onChange={e => updateSection(si, 'title', e.target.value)} placeholder="Section title" className="text-sm font-medium" />
                        {(section.rows || []).map((row: any, ri: number) => (
                            <div key={ri} className="flex gap-2">
                                <ZoruInput value={row.title || ''} onChange={e => {
                                    const rows = [...section.rows];
                                    rows[ri] = { ...rows[ri], title: e.target.value };
                                    updateSection(si, 'rows', rows);
                                }} placeholder={`Option ${ri + 1}`} className="flex-1 text-sm" />
                            </div>
                        ))}
                        {(section.rows || []).length < 10 && (
                            <ZoruButton type="button" variant="ghost" size="sm" onClick={() => addRow(si)} className="w-full text-xs"><Plus className="h-3 w-3 mr-1" /> Row</ZoruButton>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

function ConditionEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Condition Type">
                <ZoruSelect value={data.conditionType || 'variable'} onValueChange={v => onChange({ conditionType: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="variable">Check Variable</ZoruSelectItem>
                        <ZoruSelectItem value="user_response">Wait for User Response</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            {(data.conditionType === 'variable' || !data.conditionType) && (
                <Field label="Variable" hint="Use {{variable_name}} syntax">
                    <ZoruInput value={data.variable || ''} onChange={e => onChange({ variable: e.target.value })} placeholder="{{last_input}}" />
                    <VariableInserter onInsert={v => onChange({ variable: v })} />
                </Field>
            )}
            <Field label="Operator">
                <ZoruSelect value={data.operator || 'equals'} onValueChange={v => onChange({ operator: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="equals">Equals</ZoruSelectItem>
                        <ZoruSelectItem value="not_equals">Does not equal</ZoruSelectItem>
                        <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                        <ZoruSelectItem value="not_contains">Does not contain</ZoruSelectItem>
                        <ZoruSelectItem value="starts_with">Starts with</ZoruSelectItem>
                        <ZoruSelectItem value="ends_with">Ends with</ZoruSelectItem>
                        <ZoruSelectItem value="is_one_of">Is one of (comma-sep)</ZoruSelectItem>
                        <ZoruSelectItem value="is_not_one_of">Is not one of</ZoruSelectItem>
                        <ZoruSelectItem value="greater_than">Greater than</ZoruSelectItem>
                        <ZoruSelectItem value="less_than">Less than</ZoruSelectItem>
                        <ZoruSelectItem value="is_empty">Is empty</ZoruSelectItem>
                        <ZoruSelectItem value="is_not_empty">Is not empty</ZoruSelectItem>
                        <ZoruSelectItem value="regex">Matches regex</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            <Field label="Value">
                <ZoruInput value={data.value || ''} onChange={e => onChange({ value: e.target.value })} placeholder="confirmed" />
            </Field>
        </>
    );
}

function DelayEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Duration">
                <ZoruInput type="number" min="1" value={data.duration || '5'} onChange={e => onChange({ duration: e.target.value })} />
            </Field>
            <Field label="Unit">
                <ZoruSelect value={data.unit || 'seconds'} onValueChange={v => onChange({ unit: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="seconds">Seconds</ZoruSelectItem>
                        <ZoruSelectItem value="minutes">Minutes</ZoruSelectItem>
                        <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
        </>
    );
}

function InputEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Prompt Text" hint="Message sent before waiting for user input">
                <ZoruTextarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="What is your name?" rows={2} />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </Field>
            <Field label="Save Response As" hint="Variable name to store the user's response">
                <ZoruInput value={data.saveAs || ''} onChange={e => onChange({ saveAs: e.target.value })} placeholder="user_name" />
            </Field>
            <Field label="Validation" hint="Optional validation for the expected input type">
                <ZoruSelect value={data.validation || 'none'} onValueChange={v => onChange({ validation: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="none">None</ZoruSelectItem>
                        <ZoruSelectItem value="email">Email</ZoruSelectItem>
                        <ZoruSelectItem value="phone">Phone Number</ZoruSelectItem>
                        <ZoruSelectItem value="number">Number</ZoruSelectItem>
                        <ZoruSelectItem value="yes_no">Yes / No</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            <Field label="Timeout (seconds)" hint="Max wait time before continuing. 0 = forever">
                <ZoruInput type="number" min="0" value={data.timeout || '0'} onChange={e => onChange({ timeout: e.target.value })} />
            </Field>
        </>
    );
}

function SetVariableEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Variable Name">
                <ZoruInput value={data.variableName || ''} onChange={e => onChange({ variableName: e.target.value })} placeholder="order_status" />
            </Field>
            <Field label="Value" hint="Use {{var}} to reference other variables, or literal text">
                <ZoruInput value={data.variableValue || ''} onChange={e => onChange({ variableValue: e.target.value })} placeholder="confirmed" />
                <VariableInserter onInsert={v => onChange({ variableValue: (data.variableValue || '') + v })} />
            </Field>
        </>
    );
}

function ApiEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Method">
                <ZoruSelect value={data.method || 'GET'} onValueChange={v => onChange({ method: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="GET">GET</ZoruSelectItem>
                        <ZoruSelectItem value="POST">POST</ZoruSelectItem>
                        <ZoruSelectItem value="PUT">PUT</ZoruSelectItem>
                        <ZoruSelectItem value="PATCH">PATCH</ZoruSelectItem>
                        <ZoruSelectItem value="DELETE">DELETE</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            <Field label="URL">
                <ZoruInput value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://api.example.com/data" />
                <VariableInserter onInsert={v => onChange({ url: (data.url || '') + v })} />
            </Field>
            <Field label="Headers (JSON)" hint="e.g. {&quot;Authorization&quot;: &quot;Bearer xxx&quot;}">
                <ZoruTextarea value={data.headers || ''} onChange={e => onChange({ headers: e.target.value })} placeholder='{"Content-Type": "application/json"}' rows={2} className="font-mono text-xs" />
            </Field>
            <Field label="Body (JSON)" hint="For POST/PUT/PATCH. Supports {{variables}}">
                <ZoruTextarea value={data.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder='{"name": "{{name}}"}' rows={3} className="font-mono text-xs" />
                <VariableInserter onInsert={v => onChange({ body: (data.body || '') + v })} />
            </Field>
            <Field label="Save Response As" hint="Variable name to store the JSON response">
                <ZoruInput value={data.saveAs || ''} onChange={e => onChange({ saveAs: e.target.value })} placeholder="api_result" />
            </Field>
        </>
    );
}

function LocationEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Latitude"><ZoruInput value={data.latitude || ''} onChange={e => onChange({ latitude: e.target.value })} placeholder="28.6139" /></Field>
            <Field label="Longitude"><ZoruInput value={data.longitude || ''} onChange={e => onChange({ longitude: e.target.value })} placeholder="77.2090" /></Field>
            <Field label="Name"><ZoruInput value={data.name || ''} onChange={e => onChange({ name: e.target.value })} placeholder="Our Office" /></Field>
            <Field label="Address"><ZoruInput value={data.address || ''} onChange={e => onChange({ address: e.target.value })} placeholder="123 Main St" /></Field>
        </>
    );
}

function ContactEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Contact Name"><ZoruInput value={data.contactName || ''} onChange={e => onChange({ contactName: e.target.value })} placeholder="John Doe" /></Field>
            <Field label="Phone Number"><ZoruInput value={data.contactPhone || ''} onChange={e => onChange({ contactPhone: e.target.value })} placeholder="+919876543210" /></Field>
            <Field label="Email (Optional)"><ZoruInput value={data.contactEmail || ''} onChange={e => onChange({ contactEmail: e.target.value })} placeholder="john@example.com" /></Field>
        </>
    );
}

function ReactionEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥', '👏', '💯'];
    return (
        <>
            <Field label="React to" hint="Leave empty to react to the last received message">
                <ZoruInput value={data.messageId || ''} onChange={e => onChange({ messageId: e.target.value })} placeholder="Auto (last message)" />
            </Field>
            <Field label="Emoji">
                <div className="flex flex-wrap gap-1">
                    {emojis.map(e => (
                        <button key={e} type="button" onClick={() => onChange({ emoji: e })}
                            className={cn('text-xl p-1 rounded hover:bg-accent', data.emoji === e && 'bg-primary/10 ring-1 ring-primary')}>
                            {e}
                        </button>
                    ))}
                </div>
                <ZoruInput value={data.emoji || ''} onChange={e => onChange({ emoji: e.target.value })} placeholder="Or type any emoji" className="mt-1" />
            </Field>
        </>
    );
}

function CtaUrlEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Body Text"><ZoruTextarea value={data.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder="Check out our website" rows={2} /></Field>
            <Field label="ZoruButton Text"><ZoruInput value={data.displayText || ''} onChange={e => onChange({ displayText: e.target.value })} placeholder="Visit Website" /></Field>
            <Field label="URL"><ZoruInput value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://example.com" /></Field>
            <Field label="Header (Optional)"><ZoruInput value={data.header || ''} onChange={e => onChange({ header: e.target.value })} /></Field>
        </>
    );
}

function AgentEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const { activeProject } = useProject();
    const agents = (activeProject as any)?.agents || [];
    return (
        <>
            <Field label="Assign To">
                <ZoruSelect value={data.agentId || ''} onValueChange={v => {
                    const agent = agents.find((a: any) => a.userId?.toString() === v);
                    onChange({ agentId: v, agentName: agent?.name || v });
                }}>
                    <ZoruSelectTrigger><ZoruSelectValue placeholder="ZoruSelect an agent..." /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {agents.length === 0 ? (
                            <ZoruSelectItem value="" disabled>No agents configured</ZoruSelectItem>
                        ) : agents.map((a: any) => (
                            <ZoruSelectItem key={a.userId?.toString()} value={a.userId?.toString()}>{a.name || a.email}</ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            <Field label="Status" hint="Set conversation status when assigning">
                <ZoruSelect value={data.status || 'open'} onValueChange={v => onChange({ status: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="open">Open</ZoruSelectItem>
                        <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                        <ZoruSelectItem value="vip">VIP</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
        </>
    );
}

function TagEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Tag Name"><ZoruInput value={data.tagName || ''} onChange={e => onChange({ tagName: e.target.value })} placeholder="hot_lead" /></Field>
            <Field label="Action">
                <ZoruSelect value={data.tagAction || 'add'} onValueChange={v => onChange({ tagAction: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="add">Add Tag</ZoruSelectItem>
                        <ZoruSelectItem value="remove">Remove Tag</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
        </>
    );
}

function WebhookEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Webhook URL"><ZoruInput value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://hooks.example.com/trigger" /></Field>
            <Field label="Method">
                <ZoruSelect value={data.method || 'POST'} onValueChange={v => onChange({ method: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="POST">POST</ZoruSelectItem>
                        <ZoruSelectItem value="GET">GET</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
            <Field label="Include Contact Data" hint="Sends contact name, phone, variables">
                <ZoruSelect value={data.includeContact || 'true'} onValueChange={v => onChange({ includeContact: v })}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                        <ZoruSelectItem value="false">No</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </Field>
        </>
    );
}

function NotificationEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <Field label="Message"><ZoruTextarea value={data.message || ''} onChange={e => onChange({ message: e.target.value })} placeholder="New lead from WhatsApp!" rows={2} /></Field>
            <Field label="Link (Optional)"><ZoruInput value={data.link || ''} onChange={e => onChange({ link: e.target.value })} placeholder="/wachat/contacts" /></Field>
        </>
    );
}

function SimpleEditor({ data, onChange, fields }: { data: any; onChange: (d: any) => void; fields: Array<{ key: string; label: string; placeholder?: string }> }) {
    return (
        <>
            {fields.map(f => (
                <Field key={f.key} label={f.label}>
                    <ZoruInput value={data[f.key] || ''} onChange={e => onChange({ [f.key]: e.target.value })} placeholder={f.placeholder} />
                </Field>
            ))}
        </>
    );
}

/* ── Main Properties Panel ──────────────────────────── */

interface PropertiesPanelProps {
    node: any;
    availableVariables: any[];
    onUpdate: (id: string, data: Partial<any>) => void;
    deleteNode: (id: string) => void;
}

export function PropertiesPanel({ node, availableVariables, onUpdate, deleteNode }: PropertiesPanelProps) {
    if (!node) {
        return <div className="p-6 text-center text-sm text-muted-foreground">ZoruSelect a block to configure it.</div>;
    }

    const handleDataChange = (data: Partial<any>) => onUpdate(node.id, data);
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(node.id, { label: e.target.value });
    const blockInfo = ALL_BLOCK_TYPES.find(b => b.type === node.type);

    const renderEditor = () => {
        const d = node.data;
        const onChange = handleDataChange;

        switch (node.type) {
            case 'start':
                return (
                    <Field label="Trigger Keywords" hint="Comma-separated keywords that start this flow">
                        <ZoruTextarea value={d.triggerKeywords || ''} onChange={e => onChange({ triggerKeywords: e.target.value })} placeholder="hi, hello, start" rows={2} />
                    </Field>
                );
            case 'text': return <TextNodeEditor data={d} onChange={onChange} />;
            case 'image': return <MediaNodeEditor data={d} onChange={onChange} mediaType="image" />;
            case 'video': return <MediaNodeEditor data={d} onChange={onChange} mediaType="video" />;
            case 'audio': return <MediaNodeEditor data={d} onChange={onChange} mediaType="audio" />;
            case 'document': return <MediaNodeEditor data={d} onChange={onChange} mediaType="document" />;
            case 'sticker': return <MediaNodeEditor data={d} onChange={onChange} mediaType="sticker" />;
            case 'buttons': return <ButtonsNodeEditor data={d} onChange={onChange} />;
            case 'listMessage': return <ListMessageEditor data={d} onChange={onChange} />;
            case 'ctaUrl': return <CtaUrlEditor data={d} onChange={onChange} />;
            case 'input': return <InputEditor data={d} onChange={onChange} />;
            case 'condition': return <ConditionEditor data={d} onChange={onChange} />;
            case 'delay': return <DelayEditor data={d} onChange={onChange} />;
            case 'setVariable': return <SetVariableEditor data={d} onChange={onChange} />;
            case 'api': return <ApiEditor data={d} onChange={onChange} />;
            case 'webhook': return <WebhookEditor data={d} onChange={onChange} />;
            case 'sendLocation': return <LocationEditor data={d} onChange={onChange} />;
            case 'sendContact': return <ContactEditor data={d} onChange={onChange} />;
            case 'reaction': return <ReactionEditor data={d} onChange={onChange} />;
            case 'assignAgent': return <AgentEditor data={d} onChange={onChange} />;
            case 'addTag': return <TagEditor data={d} onChange={onChange} />;
            case 'notification': return <NotificationEditor data={d} onChange={onChange} />;
            case 'sendTemplate':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'templateName', label: 'Template Name', placeholder: 'order_confirmation' },
                    { key: 'templateId', label: 'Template ID', placeholder: 'ZoruSelect or enter ID' },
                ]} />;
            case 'triggerMetaFlow':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'flowMetaId', label: 'Meta Flow ID', placeholder: 'Flow ID from Meta' },
                    { key: 'flowCta', label: 'CTA Text', placeholder: 'Open Form' },
                ]} />;
            case 'triggerFlow':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'targetFlowId', label: 'Target Flow ID', placeholder: 'Flow ID to trigger' },
                ]} />;
            case 'sendSms':
                return (
                    <>
                        <Field label="Phone Number"><ZoruInput value={d.phone || ''} onChange={e => onChange({ phone: e.target.value })} placeholder="{{waId}} or +1234567890" /></Field>
                        <Field label="Message"><ZoruTextarea value={d.message || ''} onChange={e => onChange({ message: e.target.value })} placeholder="SMS text" rows={3} /></Field>
                    </>
                );
            case 'sendEmail':
                return (
                    <>
                        <Field label="To Email"><ZoruInput value={d.to || ''} onChange={e => onChange({ to: e.target.value })} placeholder="{{email}} or user@example.com" /></Field>
                        <Field label="Subject"><ZoruInput value={d.subject || ''} onChange={e => onChange({ subject: e.target.value })} placeholder="Email subject" /></Field>
                        <Field label="Body"><ZoruTextarea value={d.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder="Email body" rows={4} /></Field>
                    </>
                );
            case 'createCrmLead':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'leadName', label: 'Lead Name', placeholder: '{{name}}' },
                    { key: 'leadEmail', label: 'Email', placeholder: '{{email}}' },
                    { key: 'leadPhone', label: 'Phone', placeholder: '{{waId}}' },
                    { key: 'pipelineId', label: 'Pipeline ID', placeholder: 'ZoruSelect pipeline' },
                ]} />;
            case 'sendOrder':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'referenceId', label: 'Order Reference', placeholder: 'ORD-{{order_id}}' },
                    { key: 'totalAmount', label: 'Total Amount', placeholder: '999' },
                    { key: 'currency', label: 'Currency', placeholder: 'INR' },
                ]} />;
            case 'generateShortLink':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'url', label: 'URL to Shorten', placeholder: 'https://example.com/long-url' },
                    { key: 'saveAs', label: 'Save As Variable', placeholder: 'short_url' },
                ]} />;
            case 'generateQrCode':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'content', label: 'QR Content', placeholder: 'https://example.com' },
                    { key: 'saveAs', label: 'Save As Variable', placeholder: 'qr_url' },
                ]} />;
            default:
                return <p className="text-sm text-muted-foreground italic">No properties for this block type.</p>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background/80">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    {blockInfo?.label || node.type}
                </h3>
            </div>

            <ZoruScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* ZoruLabel */}
                    <Field label="Block ZoruLabel">
                        <ZoruInput value={node.data.label || ''} onChange={handleLabelChange} placeholder={blockInfo?.label || 'Enter label'} className="bg-background" />
                    </Field>

                    <ZoruSeparator />

                    {/* Node-specific editor */}
                    <div className="space-y-4">
                        {renderEditor()}
                    </div>
                </div>
            </ZoruScrollArea>

            {node.type !== 'start' && (
                <div className="p-4 border-t bg-background/50 mt-auto shrink-0">
                    <ZoruButton variant="ghost" className="w-full hover:bg-destructive/10 hover:text-destructive text-destructive" onClick={() => deleteNode(node.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Block
                    </ZoruButton>
                </div>
            )}
        </div>
    );
}
