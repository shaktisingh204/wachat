'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

/**
 * Editor for all v7.3 text-family components.
 * Each type exposes only the properties Meta actually accepts:
 *
 *   TextHeading    / TextSubheading : text (≤80), visible
 *   TextBody       / TextCaption    : text (≤4096), font-weight, strikethrough, markdown, visible
 *   RichText                        : text (string or array), visible
 *
 * Anything extra Meta rejects at publish time, so we deliberately keep
 * this panel narrow.
 */

interface TextEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
}

const BODY_FONT_WEIGHTS = [
    { label: 'Normal', value: 'normal' },
    { label: 'Bold', value: 'bold' },
    { label: 'Italic', value: 'italic' },
    { label: 'Bold + Italic', value: 'bold_italic' },
];

export function TextEditor({ component, updateField }: TextEditorProps) {
    const type = component?.type ?? 'TextBody';
    const isHeading = type === 'TextHeading' || type === 'TextSubheading';
    const isBody = type === 'TextBody' || type === 'TextCaption';
    const isRich = type === 'RichText';

    const maxLen = isHeading ? 80 : 4096;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="text">
                    {isRich ? 'Markdown content' : 'Text content'}
                </Label>
                <Textarea
                    id="text"
                    value={typeof component.text === 'string' ? component.text : Array.isArray(component.text) ? component.text.join('\n') : ''}
                    onChange={(e) => updateField('text', e.target.value)}
                    placeholder={isRich ? '**Bold**, *italic*, # headings, lists, [links](url)…' : 'Enter text…'}
                    maxLength={maxLen}
                    className="min-h-[90px]"
                />
                <p className="text-[10.5px] text-muted-foreground">
                    {isRich
                        ? 'RichText supports markdown: headings, bold, italic, strikethrough, lists, links, tables, inline base64 images.'
                        : `${(component.text?.length ?? 0)} / ${maxLen} characters.`}
                </p>
            </div>

            {isBody ? (
                <>
                    <div className="space-y-2">
                        <Label>Font weight</Label>
                        <Select
                            value={component['font-weight'] ?? 'normal'}
                            onValueChange={(val) => updateField('font-weight', val === 'normal' ? undefined : val)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {BODY_FONT_WEIGHTS.map(w => (
                                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DynamicBooleanInput
                        label="Strikethrough"
                        value={component.strikethrough}
                        onChange={(v) => updateField('strikethrough', v || undefined)}
                    />

                    <DynamicBooleanInput
                        label="Markdown (v5.1+)"
                        description="Parse markdown in the text content."
                        value={component.markdown}
                        onChange={(v) => updateField('markdown', v || undefined)}
                    />
                </>
            ) : null}

            <DynamicBooleanInput
                label="Visible"
                value={component.visible}
                onChange={(v) => updateField('visible', v)}
            />
        </div>
    );
}
