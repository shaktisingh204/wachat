'use client';

/**
 * Right rail of the builder. Renders a form keyed on the selected
 * block's type. Updates flow up via `onChange` (a single block patch
 * the parent splices back into the document).
 */
import { useRef } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';

import {
  Button,
  EmptyState,
  Input,
  Label,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton } from '@/components/sabfiles';
import type {
  EmailBuilderBlock,
  EmailBuilderDocument,
} from '@/lib/email/types';
import { MergeTagPicker } from './merge-tag-picker';

export interface BlockInspectorProps {
  doc: EmailBuilderDocument;
  selected: EmailBuilderBlock | null;
  onChange: (next: EmailBuilderBlock) => void;
  onSettingsChange: (next: EmailBuilderDocument['settings']) => void;
}

export function BlockInspector({
  doc,
  selected,
  onChange,
  onSettingsChange,
}: BlockInspectorProps) {
  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-l border-zoru-line bg-zoru-surface"
      aria-label="Block inspector"
    >
      <header className="px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted">
          {selected ? `Edit ${selected.type}` : 'Document'}
        </p>
      </header>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {selected ? (
            <BlockFields block={selected} onChange={onChange} />
          ) : (
            <DocumentSettingsForm settings={doc.settings} onChange={onSettingsChange} />
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

/* ────────── Document settings ────────── */

function DocumentSettingsForm({
  settings,
  onChange,
}: {
  settings: EmailBuilderDocument['settings'];
  onChange: (next: EmailBuilderDocument['settings']) => void;
}) {
  const set = <K extends keyof EmailBuilderDocument['settings']>(
    key: K,
    value: EmailBuilderDocument['settings'][K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-4">
      <Field label="Preheader (preview text)">
        <Input
          value={settings.preheader ?? ''}
          onChange={(e) => set('preheader', e.target.value)}
          placeholder="Shown in inbox preview"
        />
      </Field>
      <Field label="Font family">
        <Input
          value={settings.fontFamily ?? ''}
          onChange={(e) => set('fontFamily', e.target.value)}
        />
      </Field>
      <Field label="Width (px)">
        <Input
          type="number"
          value={settings.width ?? 600}
          onChange={(e) => set('width', Number(e.target.value) || 600)}
        />
      </Field>
      <Field label="Page background">
        <Input
          type="color"
          value={settings.backgroundColor ?? '#f4f4f7'}
          onChange={(e) => set('backgroundColor', e.target.value)}
        />
      </Field>
      <Field label="Content background">
        <Input
          type="color"
          value={settings.contentBackgroundColor ?? '#ffffff'}
          onChange={(e) => set('contentBackgroundColor', e.target.value)}
        />
      </Field>
    </div>
  );
}

/* ────────── Block field router ────────── */

function BlockFields({
  block,
  onChange,
}: {
  block: EmailBuilderBlock;
  onChange: (next: EmailBuilderBlock) => void;
}) {
  const setProp = (key: string, value: unknown) =>
    onChange({ ...block, props: { ...block.props, [key]: value } });

  const props = block.props as Record<string, unknown>;

  switch (block.type) {
    case 'text':
      return <TextFields props={props} setProp={setProp} />;
    case 'image':
      return <ImageFields props={props} setProp={setProp} />;
    case 'button':
      return <ButtonFields props={props} setProp={setProp} />;
    case 'columns':
      return <ColumnsFields block={block} onChange={onChange} />;
    case 'divider':
      return <DividerFields props={props} setProp={setProp} />;
    case 'spacer':
      return <SpacerFields props={props} setProp={setProp} />;
    case 'social':
      return <SocialFields props={props} setProp={setProp} />;
    case 'video':
      return <VideoFields props={props} setProp={setProp} />;
    case 'footer':
      return <FooterFields props={props} setProp={setProp} />;
    case 'html':
      return <HtmlFields props={props} setProp={setProp} />;
    default:
      return <EmptyState compact title="No fields" description={`Block type "${block.type}" has no editor.`} />;
  }
}

type SetProp = (key: string, value: unknown) => void;

/* ────────── Reusable atoms ────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-zoru-ink-muted">{hint}</p> : null}
    </div>
  );
}

function AlignSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <ZoruSelectTrigger>
        <ZoruSelectValue />
      </ZoruSelectTrigger>
      <ZoruSelectContent>
        <ZoruSelectItem value="left">Left</ZoruSelectItem>
        <ZoruSelectItem value="center">Center</ZoruSelectItem>
        <ZoruSelectItem value="right">Right</ZoruSelectItem>
      </ZoruSelectContent>
    </Select>
  );
}

/* ────────── Per-type field sets ────────── */

function TextFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const content = (props.content as string) ?? '';

  const insertAtCursor = (snippet: string) => {
    const el = taRef.current;
    if (!el) {
      setProp('content', content + snippet);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setProp('content', next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Content" hint="Plain text. Use merge tags for personalization.">
        <Textarea
          ref={taRef}
          value={content}
          rows={6}
          onChange={(e) => setProp('content', e.target.value)}
        />
        <div className="pt-1">
          <MergeTagPicker onPick={(tag) => insertAtCursor(tag)} />
        </div>
      </Field>
      <Field label="Text color">
        <Input
          type="color"
          value={(props.color as string) ?? '#1a1a1a'}
          onChange={(e) => setProp('color', e.target.value)}
        />
      </Field>
      <Field label="Font size (px)">
        <Input
          type="number"
          value={(props.fontSize as number) ?? 16}
          onChange={(e) => setProp('fontSize', Number(e.target.value) || 16)}
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) => setProp('padding', Number(e.target.value) || 0)}
        />
      </Field>
      <Field label="Alignment">
        <AlignSelect
          value={(props.align as string) ?? 'left'}
          onChange={(v) => setProp('align', v)}
        />
      </Field>
    </div>
  );
}

function ImageFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  const src = (props.src as string) ?? '';
  return (
    <div className="space-y-4">
      <Field label="Image source" hint="Pick a file from SabFiles.">
        {src ? (
          <div className="overflow-hidden rounded border border-zoru-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block max-h-32 w-full object-contain" />
          </div>
        ) : null}
        <SabFilePickerButton
          accept="image"
          onPick={(pick) => setProp('src', pick.url)}
        >
          <ImagePlus /> {src ? 'Replace image' : 'Choose image'}
        </SabFilePickerButton>
      </Field>
      <Field label="Alt text">
        <Input
          value={(props.alt as string) ?? ''}
          onChange={(e) => setProp('alt', e.target.value)}
        />
      </Field>
      <Field label="Width (px)">
        <Input
          type="number"
          value={(props.width as number) ?? 600}
          onChange={(e) => setProp('width', Number(e.target.value) || 600)}
        />
      </Field>
      <Field label="Link URL (optional)">
        <Input
          value={(props.href as string) ?? ''}
          onChange={(e) => setProp('href', e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Alignment">
        <AlignSelect
          value={(props.align as string) ?? 'center'}
          onChange={(v) => setProp('align', v)}
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) => setProp('padding', Number(e.target.value) || 0)}
        />
      </Field>
    </div>
  );
}

function ButtonFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <div className="space-y-4">
      <Field label="Label">
        <Input
          value={(props.label as string) ?? ''}
          onChange={(e) => setProp('label', e.target.value)}
        />
      </Field>
      <Field label="Link URL">
        <Input
          value={(props.href as string) ?? ''}
          onChange={(e) => setProp('href', e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Background color">
        <Input
          type="color"
          value={(props.backgroundColor as string) ?? '#111827'}
          onChange={(e) => setProp('backgroundColor', e.target.value)}
        />
      </Field>
      <Field label="Text color">
        <Input
          type="color"
          value={(props.textColor as string) ?? '#ffffff'}
          onChange={(e) => setProp('textColor', e.target.value)}
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) => setProp('padding', Number(e.target.value) || 0)}
        />
      </Field>
      <Field label="Border radius (px)">
        <Input
          type="number"
          value={(props.borderRadius as number) ?? 6}
          onChange={(e) => setProp('borderRadius', Number(e.target.value) || 0)}
        />
      </Field>
      <Field label="Alignment">
        <AlignSelect
          value={(props.align as string) ?? 'center'}
          onChange={(v) => setProp('align', v)}
        />
      </Field>
    </div>
  );
}

function ColumnsFields({
  block,
  onChange,
}: {
  block: EmailBuilderBlock;
  onChange: (next: EmailBuilderBlock) => void;
}) {
  const props = block.props as Record<string, unknown>;
  const columns = (props.columns as number) ?? 2;
  const children = block.children ?? [];

  const setColumnCount = (count: number) => {
    const safe = Math.min(Math.max(count, 1), 4);
    const nextChildren = [...children];
    while (nextChildren.length < safe) {
      nextChildren.push({
        id: `${block.id}-col-${nextChildren.length}-${Date.now().toString(36)}`,
        type: 'text',
        props: { content: `Column ${nextChildren.length + 1}`, padding: 8, fontSize: 14, color: '#1a1a1a', align: 'left' },
      });
    }
    nextChildren.length = safe;
    onChange({ ...block, props: { ...props, columns: safe }, children: nextChildren });
  };

  const setChildContent = (idx: number, content: string) => {
    const nextChildren = children.map((c, i) =>
      i === idx ? { ...c, props: { ...c.props, content } } : c,
    );
    onChange({ ...block, children: nextChildren });
  };

  return (
    <div className="space-y-4">
      <Field label="Number of columns (1–4)">
        <Input
          type="number"
          min={1}
          max={4}
          value={columns}
          onChange={(e) => setColumnCount(Number(e.target.value) || 1)}
        />
      </Field>
      <Field label="Gap (px)">
        <Input
          type="number"
          value={(props.gap as number) ?? 12}
          onChange={(e) =>
            onChange({ ...block, props: { ...props, gap: Number(e.target.value) || 0 } })
          }
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) =>
            onChange({ ...block, props: { ...props, padding: Number(e.target.value) || 0 } })
          }
        />
      </Field>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted">
        Column content
      </p>
      {Array.from({ length: columns }).map((_, idx) => (
        <Field key={idx} label={`Column ${idx + 1} text`}>
          <Textarea
            rows={3}
            value={(children[idx]?.props as Record<string, unknown> | undefined)?.content as string ?? ''}
            onChange={(e) => setChildContent(idx, e.target.value)}
          />
        </Field>
      ))}
    </div>
  );
}

function DividerFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <div className="space-y-4">
      <Field label="Color">
        <Input
          type="color"
          value={(props.color as string) ?? '#e5e7eb'}
          onChange={(e) => setProp('color', e.target.value)}
        />
      </Field>
      <Field label="Thickness (px)">
        <Input
          type="number"
          value={(props.thickness as number) ?? 1}
          onChange={(e) => setProp('thickness', Number(e.target.value) || 1)}
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) => setProp('padding', Number(e.target.value) || 0)}
        />
      </Field>
    </div>
  );
}

function SpacerFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <Field label="Height (px)">
      <Input
        type="number"
        value={(props.height as number) ?? 24}
        onChange={(e) => setProp('height', Number(e.target.value) || 0)}
      />
    </Field>
  );
}

function SocialFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  const networks =
    (props.networks as Array<{ network: string; url: string }>) ?? [];

  const updateNetwork = (idx: number, patch: Partial<{ network: string; url: string }>) => {
    const next = networks.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    setProp('networks', next);
  };

  const addNetwork = () =>
    setProp('networks', [...networks, { network: 'twitter', url: 'https://' }]);

  const removeNetwork = (idx: number) =>
    setProp('networks', networks.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <Field label="Alignment">
        <AlignSelect
          value={(props.align as string) ?? 'center'}
          onChange={(v) => setProp('align', v)}
        />
      </Field>
      <Field label="Padding (px)">
        <Input
          type="number"
          value={(props.padding as number) ?? 12}
          onChange={(e) => setProp('padding', Number(e.target.value) || 0)}
        />
      </Field>
      <Separator />
      <p className="text-xs font-semibold uppercase tracking-wider text-zoru-ink-muted">
        Networks
      </p>
      {networks.map((n, idx) => (
        <div key={idx} className="space-y-2 rounded border border-zoru-line p-2">
          <div className="flex items-center justify-between">
            <Label>Network {idx + 1}</Label>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove network"
              onClick={() => removeNetwork(idx)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            value={n.network}
            onChange={(e) => updateNetwork(idx, { network: e.target.value })}
            placeholder="twitter, instagram, …"
          />
          <Input
            value={n.url}
            onChange={(e) => updateNetwork(idx, { url: e.target.value })}
            placeholder="https://"
          />
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addNetwork}>
        <Plus /> Add network
      </Button>
    </div>
  );
}

function VideoFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <div className="space-y-4">
      <Field label="Poster image" hint="Shown in the email since most clients block video.">
        <SabFilePickerButton
          accept="image"
          onPick={(pick) => setProp('poster', pick.url)}
        >
          <ImagePlus /> {(props.poster as string) ? 'Replace poster' : 'Choose poster'}
        </SabFilePickerButton>
      </Field>
      <Field label="Video URL">
        <Input
          value={(props.src as string) ?? ''}
          onChange={(e) => setProp('src', e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Click-through URL">
        <Input
          value={(props.href as string) ?? ''}
          onChange={(e) => setProp('href', e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Width (px)">
        <Input
          type="number"
          value={(props.width as number) ?? 600}
          onChange={(e) => setProp('width', Number(e.target.value) || 600)}
        />
      </Field>
    </div>
  );
}

function FooterFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <div className="space-y-4">
      <Field label="Company name">
        <Input
          value={(props.companyName as string) ?? ''}
          onChange={(e) => setProp('companyName', e.target.value)}
        />
      </Field>
      <Field label="Address">
        <Textarea
          rows={2}
          value={(props.address as string) ?? ''}
          onChange={(e) => setProp('address', e.target.value)}
        />
      </Field>
      <Field label="Unsubscribe link text">
        <Input
          value={(props.unsubscribeText as string) ?? ''}
          onChange={(e) => setProp('unsubscribeText', e.target.value)}
        />
      </Field>
      <Field label="Unsubscribe URL" hint="Use {{unsubscribeUrl}} merge tag.">
        <Input
          value={(props.unsubscribeUrl as string) ?? '{{unsubscribeUrl}}'}
          onChange={(e) => setProp('unsubscribeUrl', e.target.value)}
        />
      </Field>
      <Field label="Text color">
        <Input
          type="color"
          value={(props.color as string) ?? '#6b7280'}
          onChange={(e) => setProp('color', e.target.value)}
        />
      </Field>
    </div>
  );
}

function HtmlFields({ props, setProp }: { props: Record<string, unknown>; setProp: SetProp }) {
  return (
    <Field label="Raw HTML" hint="Used verbatim. Be careful.">
      <Textarea
        rows={10}
        value={(props.html as string) ?? ''}
        onChange={(e) => setProp('html', e.target.value)}
      />
    </Field>
  );
}

