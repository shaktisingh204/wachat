'use client';

import {
  Label,
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Separator } from '@/components/sabcrm/20ui';
import {
  useState } from 'react';

import { Trash2, Settings2, Plus, Variable } from 'lucide-react';
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
        { key: '{{last_input}}', label: 'Last User Input' },
        { key: '{{cart_summary}}', label: 'Cart Summary' },
        { key: '{{custom.', label: 'Custom Variable...' },
    ];
    if (!open) return (
        <Button
            variant="ghost"
            size="sm"
            iconLeft={Variable}
            onClick={() => setOpen(true)}
            className="text-[10px]"
        >
            Insert variable
        </Button>
    );
    return (
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-2 space-y-1">
            {vars.map(v => (
                <Button
                    key={v.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => { onInsert(v.key); setOpen(false); }}
                    className="block w-full justify-start text-left text-[11px] truncate"
                >
                    <code className="text-[var(--st-text)]">{v.key}</code>{' '}
                    <span className="text-[var(--st-text-secondary)] ml-1">{v.label}</span>
                </Button>
            ))}
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-[10px] text-[var(--st-text-secondary)] ml-2"
            >
                Close
            </Button>
        </div>
    );
}

/* ── Reusable editor field ──────────────────────────── */

function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <Field label={<span className="text-xs">{label}</span>} help={hint}>
            {children}
        </Field>
    );
}

/* ── Node-specific editors ──────────────────────────── */

function TextNodeEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Message Text">
                <Textarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="Hello {{name}}! How can I help you today?" className="min-h-[100px] text-sm" />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </EditorField>
            <EditorField label="Preview URL" hint="If enabled, URLs in the message will show a link preview">
                <Select value={data.previewUrl || 'true'} onValueChange={v => onChange({ previewUrl: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Enabled</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
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
            <EditorField label={`${mediaType} URL`}>
                <SabFileUrlInput
                    value={data.mediaUrl || ''}
                    onChange={(v) => onChange({ mediaUrl: v })}
                    accept={accept}
                    placeholder="https://example.com/media.jpg"
                />
            </EditorField>
            <EditorField label="Or Base64 Data" hint="Paste a base64 data URI">
                <Input value={data.imageBase64 || ''} onChange={e => onChange({ imageBase64: e.target.value })} placeholder="data:image/png;base64,..." />
            </EditorField>
            {mediaType !== 'sticker' && mediaType !== 'audio' && (
                <EditorField label="Caption">
                    <Textarea value={data.caption || ''} onChange={e => onChange({ caption: e.target.value })} placeholder="Optional caption" rows={2} />
                    <VariableInserter onInsert={v => onChange({ caption: (data.caption || '') + v })} />
                </EditorField>
            )}
            {mediaType === 'document' && (
                <EditorField label="Filename">
                    <Input value={data.filename || ''} onChange={e => onChange({ filename: e.target.value })} placeholder="report.pdf" />
                </EditorField>
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
            <EditorField label="Message Body">
                <Textarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="What would you like to do?" rows={3} />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </EditorField>
            <EditorField label="Header (Optional)">
                <Input value={data.header || ''} onChange={e => onChange({ header: e.target.value })} placeholder="Choose an option" />
            </EditorField>
            <EditorField label="Footer (Optional)">
                <Input value={data.footer || ''} onChange={e => onChange({ footer: e.target.value })} />
            </EditorField>
            <div className="space-y-2">
                <Label className="text-xs">Buttons ({buttons.length}/3)</Label>
                {buttons.map((btn: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input value={btn.text || ''} onChange={e => updateBtn(i, 'text', e.target.value)} placeholder={`Button ${i + 1}`} className="flex-1 text-sm" />
                        <IconButton label={`Remove button ${i + 1}`} icon={Trash2} variant="ghost" size="sm" onClick={() => removeBtn(i)} />
                    </div>
                ))}
                {buttons.length < 3 && (
                    <Button type="button" variant="outline" size="sm" iconLeft={Plus} onClick={addBtn} block>Add Button</Button>
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
            <EditorField label="Body Text">
                <Textarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="Choose from the options below" rows={2} />
            </EditorField>
            <EditorField label="Button Text" hint="Text shown on the list menu button">
                <Input value={data.buttonText || ''} onChange={e => onChange({ buttonText: e.target.value })} placeholder="View Options" />
            </EditorField>
            <EditorField label="Header (Optional)">
                <Input value={data.header || ''} onChange={e => onChange({ header: e.target.value })} />
            </EditorField>
            <div className="space-y-3">
                {sections.map((section: any, si: number) => (
                    <div key={si} className="border border-[var(--st-border)] rounded-[var(--st-radius)] p-2 space-y-2">
                        <Input value={section.title || ''} onChange={e => updateSection(si, 'title', e.target.value)} placeholder="Section title" className="text-sm font-medium" />
                        {(section.rows || []).map((row: any, ri: number) => (
                            <div key={ri} className="flex gap-2">
                                <Input value={row.title || ''} onChange={e => {
                                    const rows = [...section.rows];
                                    rows[ri] = { ...rows[ri], title: e.target.value };
                                    updateSection(si, 'rows', rows);
                                }} placeholder={`Option ${ri + 1}`} className="flex-1 text-sm" />
                            </div>
                        ))}
                        {(section.rows || []).length < 10 && (
                            <Button type="button" variant="ghost" size="sm" iconLeft={Plus} onClick={() => addRow(si)} block className="text-xs">Row</Button>
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
            <EditorField label="Condition Type">
                <Select value={data.conditionType || 'variable'} onValueChange={v => onChange({ conditionType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="variable">Check Variable</SelectItem>
                        <SelectItem value="user_response">Wait for User Response</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
            {(data.conditionType === 'variable' || !data.conditionType) && (
                <EditorField label="Variable" hint="Use {{variable_name}} syntax">
                    <Input value={data.variable || ''} onChange={e => onChange({ variable: e.target.value })} placeholder="{{last_input}}" />
                    <VariableInserter onInsert={v => onChange({ variable: v })} />
                </EditorField>
            )}
            <EditorField label="Operator">
                <Select value={data.operator || 'equals'} onValueChange={v => onChange({ operator: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="not_equals">Does not equal</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="not_contains">Does not contain</SelectItem>
                        <SelectItem value="starts_with">Starts with</SelectItem>
                        <SelectItem value="ends_with">Ends with</SelectItem>
                        <SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem>
                        <SelectItem value="is_not_one_of">Is not one of</SelectItem>
                        <SelectItem value="greater_than">Greater than</SelectItem>
                        <SelectItem value="less_than">Less than</SelectItem>
                        <SelectItem value="is_empty">Is empty</SelectItem>
                        <SelectItem value="is_not_empty">Is not empty</SelectItem>
                        <SelectItem value="regex">Matches regex</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
            <EditorField label="Value">
                <Input value={data.value || ''} onChange={e => onChange({ value: e.target.value })} placeholder="confirmed" />
            </EditorField>
        </>
    );
}

function DelayEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Duration">
                <Input type="number" min="1" value={data.duration || '5'} onChange={e => onChange({ duration: e.target.value })} />
            </EditorField>
            <EditorField label="Unit">
                <Select value={data.unit || 'seconds'} onValueChange={v => onChange({ unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="seconds">Seconds</SelectItem>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
        </>
    );
}

function InputEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Prompt Text" hint="Message sent before waiting for user input">
                <Textarea value={data.text || ''} onChange={e => onChange({ text: e.target.value })} placeholder="What is your name?" rows={2} />
                <VariableInserter onInsert={v => onChange({ text: (data.text || '') + v })} />
            </EditorField>
            <EditorField label="Save Response As" hint="Variable name to store the user's response">
                <Input value={data.saveAs || ''} onChange={e => onChange({ saveAs: e.target.value })} placeholder="user_name" />
            </EditorField>
            <EditorField label="Validation" hint="Optional validation for the expected input type">
                <Select value={data.validation || 'none'} onValueChange={v => onChange({ validation: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone Number</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="yes_no">Yes / No</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
            <EditorField label="Timeout (seconds)" hint="Max wait time before continuing. 0 = forever">
                <Input type="number" min="0" value={data.timeout || '0'} onChange={e => onChange({ timeout: e.target.value })} />
            </EditorField>
        </>
    );
}

function SetVariableEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Variable Name">
                <Input value={data.variableName || ''} onChange={e => onChange({ variableName: e.target.value })} placeholder="order_status" />
            </EditorField>
            <EditorField label="Value" hint="Use {{var}} to reference other variables, or literal text">
                <Input value={data.variableValue || ''} onChange={e => onChange({ variableValue: e.target.value })} placeholder="confirmed" />
                <VariableInserter onInsert={v => onChange({ variableValue: (data.variableValue || '') + v })} />
            </EditorField>
        </>
    );
}

function ApiEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Method">
                <Select value={data.method || 'GET'} onValueChange={v => onChange({ method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
            <EditorField label="URL">
                <Input value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://api.example.com/data" />
                <VariableInserter onInsert={v => onChange({ url: (data.url || '') + v })} />
            </EditorField>
            <EditorField label="Headers (JSON)" hint='e.g. {"Authorization": "Bearer xxx"}'>
                <Textarea value={data.headers || ''} onChange={e => onChange({ headers: e.target.value })} placeholder='{"Content-Type": "application/json"}' rows={2} className="font-mono text-xs" />
            </EditorField>
            <EditorField label="Body (JSON)" hint="For POST/PUT/PATCH. Supports {{variables}}">
                <Textarea value={data.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder='{"name": "{{name}}"}' rows={3} className="font-mono text-xs" />
                <VariableInserter onInsert={v => onChange({ body: (data.body || '') + v })} />
            </EditorField>
            <EditorField label="Save Response As" hint="Variable name to store the JSON response">
                <Input value={data.saveAs || ''} onChange={e => onChange({ saveAs: e.target.value })} placeholder="api_result" />
            </EditorField>
        </>
    );
}

function LocationEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Latitude"><Input value={data.latitude || ''} onChange={e => onChange({ latitude: e.target.value })} placeholder="28.6139" /></EditorField>
            <EditorField label="Longitude"><Input value={data.longitude || ''} onChange={e => onChange({ longitude: e.target.value })} placeholder="77.2090" /></EditorField>
            <EditorField label="Name"><Input value={data.name || ''} onChange={e => onChange({ name: e.target.value })} placeholder="Our Office" /></EditorField>
            <EditorField label="Address"><Input value={data.address || ''} onChange={e => onChange({ address: e.target.value })} placeholder="123 Main St" /></EditorField>
        </>
    );
}

function ContactEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Contact Name"><Input value={data.contactName || ''} onChange={e => onChange({ contactName: e.target.value })} placeholder="John Doe" /></EditorField>
            <EditorField label="Phone Number"><Input value={data.contactPhone || ''} onChange={e => onChange({ contactPhone: e.target.value })} placeholder="+919876543210" /></EditorField>
            <EditorField label="Email (Optional)"><Input value={data.contactEmail || ''} onChange={e => onChange({ contactEmail: e.target.value })} placeholder="john@example.com" /></EditorField>
        </>
    );
}

function ReactionEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥', '👏', '💯'];
    return (
        <>
            <EditorField label="React to" hint="Leave empty to react to the last received message">
                <Input value={data.messageId || ''} onChange={e => onChange({ messageId: e.target.value })} placeholder="Auto (last message)" />
            </EditorField>
            <EditorField label="Emoji">
                <div className="flex flex-wrap gap-1">
                    {emojis.map(e => (
                        <Button
                            key={e}
                            variant="ghost"
                            size="sm"
                            aria-label={`React with ${e}`}
                            aria-pressed={data.emoji === e}
                            onClick={() => onChange({ emoji: e })}
                            className={cn('text-xl', data.emoji === e && 'ring-1 ring-[var(--st-accent)]')}
                        >
                            {e}
                        </Button>
                    ))}
                </div>
                <Input value={data.emoji || ''} onChange={e => onChange({ emoji: e.target.value })} placeholder="Or type any emoji" className="mt-1" />
            </EditorField>
        </>
    );
}

function CtaUrlEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Body Text"><Textarea value={data.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder="Check out our website" rows={2} /></EditorField>
            <EditorField label="Button Text"><Input value={data.displayText || ''} onChange={e => onChange({ displayText: e.target.value })} placeholder="Visit Website" /></EditorField>
            <EditorField label="URL"><Input value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://example.com" /></EditorField>
            <EditorField label="Header (Optional)"><Input value={data.header || ''} onChange={e => onChange({ header: e.target.value })} /></EditorField>
        </>
    );
}

function AgentEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    const { activeProject } = useProject();
    const agents = (activeProject as any)?.agents || [];
    return (
        <>
            <EditorField label="Assign To">
                <Select value={data.agentId || ''} onValueChange={v => {
                    const agent = agents.find((a: any) => a.userId?.toString() === v);
                    onChange({ agentId: v, agentName: agent?.name || v });
                }}>
                    <SelectTrigger><SelectValue placeholder="Select an agent..." /></SelectTrigger>
                    <SelectContent>
                        {agents.length === 0 ? (
                            <SelectItem value="__placeholder__" disabled>No agents configured</SelectItem>
                        ) : agents.map((a: any) => (
                            <SelectItem key={a.userId?.toString()} value={a.userId?.toString()}>{a.name || a.email}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </EditorField>
            <EditorField label="Status" hint="Set conversation status when assigning">
                <Select value={data.status || 'open'} onValueChange={v => onChange({ status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
        </>
    );
}

function TagEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Tag Name"><Input value={data.tagName || ''} onChange={e => onChange({ tagName: e.target.value })} placeholder="hot_lead" /></EditorField>
            <EditorField label="Action">
                <Select value={data.tagAction || 'add'} onValueChange={v => onChange({ tagAction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="add">Add Tag</SelectItem>
                        <SelectItem value="remove">Remove Tag</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
        </>
    );
}

function WebhookEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Webhook URL"><Input value={data.url || ''} onChange={e => onChange({ url: e.target.value })} placeholder="https://hooks.example.com/trigger" /></EditorField>
            <EditorField label="Method">
                <Select value={data.method || 'POST'} onValueChange={v => onChange({ method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
            <EditorField label="Include Contact Data" hint="Sends contact name, phone, variables">
                <Select value={data.includeContact || 'true'} onValueChange={v => onChange({ includeContact: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                </Select>
            </EditorField>
        </>
    );
}

function NotificationEditor({ data, onChange }: { data: any; onChange: (d: any) => void }) {
    return (
        <>
            <EditorField label="Message"><Textarea value={data.message || ''} onChange={e => onChange({ message: e.target.value })} placeholder="New lead from WhatsApp!" rows={2} /></EditorField>
            <EditorField label="Link (Optional)"><Input value={data.link || ''} onChange={e => onChange({ link: e.target.value })} placeholder="/wachat/contacts" /></EditorField>
        </>
    );
}

function SimpleEditor({ data, onChange, fields }: { data: any; onChange: (d: any) => void; fields: Array<{ key: string; label: string; placeholder?: string }> }) {
    return (
        <>
            {fields.map(f => (
                <EditorField key={f.key} label={f.label}>
                    <Input value={data[f.key] || ''} onChange={e => onChange({ [f.key]: e.target.value })} placeholder={f.placeholder} />
                </EditorField>
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
        return <div className="p-6 text-center text-sm text-[var(--st-text-secondary)]">Select a block to configure it.</div>;
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
                    <EditorField label="Trigger Keywords" hint="Comma-separated keywords that start this flow">
                        <Textarea value={d.triggerKeywords || ''} onChange={e => onChange({ triggerKeywords: e.target.value })} placeholder="hi, hello, start" rows={2} />
                    </EditorField>
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
                    { key: 'templateId', label: 'Template ID', placeholder: 'Select or enter ID' },
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
                        <EditorField label="Phone Number"><Input value={d.phone || ''} onChange={e => onChange({ phone: e.target.value })} placeholder="{{waId}} or +1234567890" /></EditorField>
                        <EditorField label="Message"><Textarea value={d.message || ''} onChange={e => onChange({ message: e.target.value })} placeholder="SMS text" rows={3} /></EditorField>
                    </>
                );
            case 'sendEmail':
                return (
                    <>
                        <EditorField label="To Email"><Input value={d.to || ''} onChange={e => onChange({ to: e.target.value })} placeholder="{{email}} or user@example.com" /></EditorField>
                        <EditorField label="Subject"><Input value={d.subject || ''} onChange={e => onChange({ subject: e.target.value })} placeholder="Email subject" /></EditorField>
                        <EditorField label="Body"><Textarea value={d.body || ''} onChange={e => onChange({ body: e.target.value })} placeholder="Email body" rows={4} /></EditorField>
                    </>
                );
            case 'createCrmLead':
                return <SimpleEditor data={d} onChange={onChange} fields={[
                    { key: 'leadName', label: 'Lead Name', placeholder: '{{name}}' },
                    { key: 'leadEmail', label: 'Email', placeholder: '{{email}}' },
                    { key: 'leadPhone', label: 'Phone', placeholder: '{{waId}}' },
                    { key: 'pipelineId', label: 'Pipeline ID', placeholder: 'Select pipeline' },
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
                return <p className="text-sm text-[var(--st-text-secondary)] italic">No properties for this block type.</p>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--st-bg-secondary)]/50 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--st-border)] shrink-0 bg-[var(--st-bg-secondary)]/80">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--st-text)]">
                    <Settings2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {blockInfo?.label || node.type}
                </h3>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* Label */}
                    <EditorField label="Block Label">
                        <Input value={node.data.label || ''} onChange={handleLabelChange} placeholder={blockInfo?.label || 'Enter label'} className="bg-[var(--st-bg-secondary)]" />
                    </EditorField>

                    <Separator />

                    {/* Node-specific editor */}
                    <div className="space-y-4">
                        {renderEditor()}
                    </div>
                </div>
            </ScrollArea>

            {node.type !== 'start' && (
                <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 mt-auto shrink-0">
                    <Button variant="ghost" block iconLeft={Trash2} onClick={() => deleteNode(node.id)} className="text-[var(--st-text)]">
                        Delete Block
                    </Button>
                </div>
            )}
        </div>
    );
}
