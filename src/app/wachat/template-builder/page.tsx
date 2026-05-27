'use client';

import * as React from 'react';
import { fmtDate } from '@/lib/utils';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { memo, useMemo, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  Plus,
  Copy,
  Trash2,
  GripVertical,
  History,
  Image as ImageIcon,
  Video,
  FileText,
  Sun,
  Moon,
  Eye,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Variable,
  Hash,
  Type as TypeIcon,
  MessageSquare,
  ExternalLink,
  Phone,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useProject } from '@/context/project-context';

import {
  WaPage,
  PageHeader,
  WaButton,
  PhoneFrame,
  ChatBubble,
} from '@/components/wachat-ui';

type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document';
type BtnType = 'quick_reply' | 'url' | 'phone';

interface TplButton {
  type: BtnType;
  text: string;
  value: string;
}

const LIMITS = { body: 1024, header: 60, footer: 60, button: 25, maxButtons: 3 };

const SortableBlock = memo(
  ({ id, children }: { id: string; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : 1,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="group relative">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="absolute -left-7 top-6 grid h-7 w-7 cursor-grab place-items-center rounded-full text-zinc-400 opacity-0 transition-opacity duration-150 hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
        {children}
      </div>
    );
  },
);
SortableBlock.displayName = 'SortableBlock';

function BlockCard({
  title,
  children,
  meta,
}: {
  title: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          {title}
        </h2>
        {meta && <span className="text-[10.5px] tabular-nums text-zinc-500">{meta}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function LimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  const near = !over && pct >= 80;
  return (
    <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{
          width: `${Math.min(100, pct)}%`,
          background: over ? '#f43f5e' : near ? '#f59e0b' : 'var(--mt-accent)',
        }}
      />
    </div>
  );
}

export default function TemplateBuilderPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();

  const [category, setCategory] = useState('marketing');
  const [headerType, setHeaderType] = useState<HeaderType>('none');
  const [headerText, setHeaderText] = useState('');
  const [body, setBody] = useState('Hello {{1}}, your order {{2}} is confirmed!');
  const [footer, setFooter] = useState('Powered by Wachat');
  const [buttons, setButtons] = useState<TplButton[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({
    '1': 'Alex',
    '2': 'ORD-1042',
  });
  const [previewMode, setPreviewMode] = useState<'light' | 'dark' | 'both'>('both');

  const [blocks, setBlocks] = useState(['category', 'header', 'body', 'footer', 'buttons']);

  const [saveOpen, setSaveOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const [versions, setVersions] = useState<
    { id: string; name: string; timestamp: number; state: any }[]
  >([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const insertVar = (n: number) => setBody((p) => p + ` {{${n}}}`);
  const addButton = () => {
    if (buttons.length < LIMITS.maxButtons)
      setButtons((p) => [...p, { type: 'quick_reply', text: '', value: '' }]);
  };
  const updateButton = (i: number, patch: Partial<TplButton>) =>
    setButtons((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeButton = (i: number) => setButtons((p) => p.filter((_, idx) => idx !== i));

  /* ── derived ──────────────────────────────────────────────── */

  const varList = useMemo(() => {
    const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g)).map((m) => m[1]);
    return Array.from(new Set(matches)).sort((a, b) => Number(a) - Number(b));
  }, [body]);

  const renderedBody = useMemo(() => {
    return body.replace(/{{\s*(\d+)\s*}}/g, (_, k) =>
      variableValues[k] !== undefined && variableValues[k] !== ''
        ? variableValues[k]
        : `{{${k}}}`,
    );
  }, [body, variableValues]);

  type Check = { ok: boolean; severity: 'error' | 'warn'; label: string };
  const checks = useMemo<Check[]>(() => {
    const out: Check[] = [];
    out.push({ ok: body.trim().length > 0, severity: 'error', label: 'Body text is present.' });
    out.push({ ok: body.length <= LIMITS.body, severity: 'error', label: `Body within ${LIMITS.body} chars.` });
    if (headerType === 'text') {
      out.push({
        ok: headerText.length > 0 && headerText.length <= LIMITS.header,
        severity: 'error',
        label: `Text header 1-${LIMITS.header} chars.`,
      });
    }
    out.push({
      ok: footer.length <= LIMITS.footer,
      severity: 'error',
      label: `Footer within ${LIMITS.footer} chars.`,
    });
    out.push({
      ok: buttons.length <= LIMITS.maxButtons,
      severity: 'error',
      label: `Max ${LIMITS.maxButtons} buttons.`,
    });
    out.push({
      ok: buttons.every((b) => b.text.length <= LIMITS.button),
      severity: 'error',
      label: `Each button label within ${LIMITS.button} chars.`,
    });
    out.push({
      ok: buttons.every((b) => b.type === 'quick_reply' || b.value.trim().length > 0),
      severity: 'error',
      label: 'URL / phone buttons have a value.',
    });
    const varsNumbers = varList.map(Number).sort((a, b) => a - b);
    if (varsNumbers.length > 0) {
      out.push({
        ok: varsNumbers.every((n, idx) => n === idx + 1),
        severity: 'error',
        label: 'Variables numbered sequentially from {{1}}.',
      });
    }
    out.push({
      ok: !/\b(click here|buy now|act fast|limited offer|free!)\b/i.test(body),
      severity: 'warn',
      label: 'No salesy phrases ("buy now", "click here", "act fast").',
    });
    return out;
  }, [body, headerType, headerText, footer, buttons, varList]);

  const errors = checks.filter((c) => !c.ok && c.severity === 'error').length;
  const warnings = checks.filter((c) => !c.ok && c.severity === 'warn').length;

  /* ── payload + save ──────────────────────────────────────── */

  const buildPayload = () => {
    const components: any[] = [];
    if (headerType === 'text' && headerText)
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    else if (headerType !== 'none')
      components.push({ type: 'HEADER', format: headerType.toUpperCase() });
    components.push({ type: 'BODY', text: body });
    if (footer) components.push({ type: 'FOOTER', text: footer });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => ({
          type: b.type === 'quick_reply' ? 'QUICK_REPLY' : b.type.toUpperCase(),
          text: b.text,
          ...(b.type !== 'quick_reply' ? { [b.type]: b.value } : {}),
        })),
      });
    }
    return {
      name: `template_${Date.now()}`,
      category: category.toUpperCase(),
      language: 'en_US',
      components,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);

    const newState = { category, headerType, headerText, body, footer, buttons, blocks };
    const newVersion = {
      id: `v_${Date.now()}`,
      name: `Version ${versions.length + 1}`,
      timestamp: Date.now(),
      state: newState,
    };
    setVersions((prev) => [newVersion, ...prev]);

    await navigator.clipboard.writeText(json);
    toast({
      title: 'Template JSON copied and version saved',
      description: `Template payload (${json.length} chars) copied to clipboard.`,
    });
    setSaveOpen(false);
  };

  const loadVersion = (ver: any) => {
    setCategory(ver.state.category);
    setHeaderType(ver.state.headerType);
    setHeaderText(ver.state.headerText);
    setBody(ver.state.body);
    setFooter(ver.state.footer);
    setButtons(ver.state.buttons);
    if (ver.state.blocks) setBlocks(ver.state.blocks);

    toast({ title: 'Version loaded', description: `Loaded ${ver.name}` });
    setVersionsOpen(false);
  };

  /* ── blocks ──────────────────────────────────────────────── */

  const categoryBlock = useMemo(
    () => (
      <BlockCard title="Category">
        <Select value={category} onValueChange={setCategory}>
          <ZoruSelectTrigger>
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="marketing">Marketing</ZoruSelectItem>
            <ZoruSelectItem value="utility">Utility</ZoruSelectItem>
            <ZoruSelectItem value="authentication">Authentication</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
      </BlockCard>
    ),
    [category],
  );

  const headerBlock = useMemo(
    () => (
      <BlockCard
        title="Header"
        meta={
          headerType === 'text'
            ? `${headerText.length} / ${LIMITS.header}`
            : headerType !== 'none'
            ? headerType
            : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          {(['none', 'text', 'image', 'video', 'document'] as const).map((t) => {
            const isActive = headerType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setHeaderType(t)}
                className="rounded-full border px-3 py-1.5 text-[11.5px] font-semibold capitalize transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.97]"
                style={{
                  borderColor: isActive ? 'var(--mt-accent)' : '#e4e4e7',
                  color: isActive ? '#ffffff' : '#52525b',
                  backgroundColor: isActive ? 'var(--mt-accent)' : '#ffffff',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        {headerType === 'text' && (
          <>
            <Input
              placeholder="Header text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              maxLength={LIMITS.header}
            />
            <LimitBar used={headerText.length} limit={LIMITS.header} />
          </>
        )}
        {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
          <p className="text-[11.5px] text-zinc-500">
            Upload {headerType} when submitting for approval.
          </p>
        )}
      </BlockCard>
    ),
    [headerType, headerText],
  );

  const bodyBlock = useMemo(
    () => (
      <BlockCard title="Body" meta={`${body.length} / ${LIMITS.body}`}>
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body"
        />
        <LimitBar used={body.length} limit={LIMITS.body} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-zinc-500">Insert variable:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => insertVar(n)}
              className="rounded-full border border-zinc-200 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97]"
            >{`{{${n}}}`}</button>
          ))}
        </div>
      </BlockCard>
    ),
    [body],
  );

  const footerBlock = useMemo(
    () => (
      <BlockCard title="Footer" meta={`${footer.length} / ${LIMITS.footer}`}>
        <Input
          placeholder="Footer text (optional)"
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          maxLength={LIMITS.footer}
        />
        <LimitBar used={footer.length} limit={LIMITS.footer} />
      </BlockCard>
    ),
    [footer],
  );

  const buttonsBlock = useMemo(
    () => (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Buttons
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] tabular-nums text-zinc-500">
              {buttons.length} / {LIMITS.maxButtons}
            </span>
            <WaButton
              size="sm"
              variant="outline"
              onClick={addButton}
              disabled={buttons.length >= LIMITS.maxButtons}
              leftIcon={Plus}
            >
              Add
            </WaButton>
          </div>
        </div>
        <div className="space-y-2.5">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5"
            >
              <div className="min-w-[140px]">
                <Select
                  value={btn.type}
                  onValueChange={(v) => updateButton(i, { type: v as BtnType })}
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="quick_reply">Quick reply</ZoruSelectItem>
                    <ZoruSelectItem value="url">URL</ZoruSelectItem>
                    <ZoruSelectItem value="phone">Phone</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <Input
                className="min-w-[120px] flex-1"
                placeholder={`Button label (${LIMITS.button} max)`}
                value={btn.text}
                maxLength={LIMITS.button}
                onChange={(e) => updateButton(i, { text: e.target.value })}
              />
              {btn.type !== 'quick_reply' && (
                <Input
                  className="min-w-[120px] flex-1"
                  placeholder={btn.type === 'url' ? 'https://' : '+1234567890'}
                  value={btn.value}
                  onChange={(e) => updateButton(i, { value: e.target.value })}
                />
              )}
              <button
                type="button"
                aria-label="Remove button"
                onClick={() => removeButton(i)}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-white hover:text-rose-600 active:scale-[0.97]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
          ))}
          {buttons.length === 0 && (
            <p className="text-[11.5px] text-zinc-500">
              No buttons yet. Click Add to insert a quick reply, URL, or phone button.
            </p>
          )}
        </div>
      </div>
    ),
    [buttons],
  );

  const blockMap: Record<string, React.ReactNode> = {
    category: categoryBlock,
    header: headerBlock,
    body: bodyBlock,
    footer: footerBlock,
    buttons: buttonsBlock,
  };

  const mediaIcon =
    headerType === 'image'
      ? ImageIcon
      : headerType === 'video'
      ? Video
      : headerType === 'document'
      ? FileText
      : null;

  const renderPreviewBody = (
    <AnimatePresence mode="popLayout" initial={false}>
      {mediaIcon && (
        <m.div
          key={`media-${headerType}`}
          layout
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="flex justify-start"
        >
          <div className="grid h-24 w-[80%] place-items-center rounded-2xl rounded-bl-sm bg-white/95 shadow-sm">
            {React.createElement(mediaIcon, {
              className: 'h-7 w-7 text-emerald-700/60',
              strokeWidth: 1.75,
              'aria-hidden': true,
            })}
          </div>
        </m.div>
      )}

      {headerType === 'text' && headerText && (
        <m.div key="header-text" layout transition={{ duration: 0.25, ease: EASE_OUT }}>
          <ChatBubble
            who="them"
            text={
              <span className="text-[12.5px] font-semibold text-zinc-900">{headerText}</span>
            }
          />
        </m.div>
      )}

      <m.div key="body" layout transition={{ duration: 0.25, ease: EASE_OUT }}>
        <ChatBubble
          who="them"
          text={
            <div className="space-y-1">
              <p className="whitespace-pre-wrap">{renderedBody || 'Message body'}</p>
              {footer && <p className="pt-1 text-[10px] text-zinc-500">{footer}</p>}
            </div>
          }
          time="12:00 PM"
        />
      </m.div>

      {buttons.length > 0 && (
        <m.div
          key="buttons"
          layout
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="space-y-1 pt-1"
        >
          {buttons.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 shadow-sm"
            >
              {b.type === 'url' && <ExternalLink className="h-3 w-3" strokeWidth={2.25} />}
              {b.type === 'phone' && <Phone className="h-3 w-3" strokeWidth={2.25} />}
              {b.text || 'Button'}
            </div>
          ))}
        </m.div>
      )}
    </AnimatePresence>
  );

  return (
    <WaPage>
      <PageHeader
        title="Template builder"
        description="Build WhatsApp message templates visually. Drag-reorder blocks, preview in dual mode, and copy the JSON for submission."
        kicker={activeProject?.name ? `Wachat · ${activeProject.name}` : 'Wachat · builder'}
        backHref="/wachat/templates"
        actions={
          <>
            <div className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-white p-0.5 sm:inline-flex">
              {(['light', 'both', 'dark'] as const).map((mode) => {
                const isActive = previewMode === mode;
                const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Eye;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreviewMode(mode)}
                    aria-pressed={isActive}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors capitalize"
                    style={{
                      color: isActive ? '#ffffff' : '#52525b',
                      background: isActive ? 'var(--mt-accent)' : 'transparent',
                    }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    {mode}
                  </button>
                );
              })}
            </div>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={History}
              onClick={() => setVersionsOpen(true)}
            >
              Versions ({versions.length})
            </WaButton>
            <WaButton size="sm" leftIcon={Copy} onClick={() => setSaveOpen(true)}>
              Save template
            </WaButton>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3 pl-8">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks} strategy={verticalListSortingStrategy}>
              {blocks.map((id) => (
                <SortableBlock key={id} id={id}>
                  {blockMap[id]}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="space-y-3">
            <div className={previewMode === 'both' ? 'grid grid-cols-2 gap-3' : ''}>
              {(previewMode === 'light' || previewMode === 'both') && (
                <div className="space-y-1.5">
                  <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <Sun className="h-2.5 w-2.5" strokeWidth={2.25} /> Light
                  </p>
                  <PhoneFrame title={activeProject?.name ?? 'Wachat Business'} subtitle="online">
                    {renderPreviewBody}
                  </PhoneFrame>
                </div>
              )}
              {(previewMode === 'dark' || previewMode === 'both') && (
                <div className="space-y-1.5">
                  <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <Moon className="h-2.5 w-2.5" strokeWidth={2.25} /> Dark
                  </p>
                  <div className="[&_.bg-white\\/95]:bg-zinc-800/95 [&_.bg-white\\/95]:text-zinc-100 [&_.text-emerald-700]:text-emerald-300 [&_.text-zinc-800]:text-zinc-100 [&_.text-zinc-900]:text-zinc-50 [&_.text-zinc-500]:text-zinc-400 [&_.text-zinc-600]:text-zinc-300 [&_.text-emerald-700\\/60]:text-emerald-200/70">
                    <PhoneFrame title={activeProject?.name ?? 'Wachat Business'} subtitle="online">
                      {renderPreviewBody}
                    </PhoneFrame>
                  </div>
                </div>
              )}
            </div>

            {/* Structure stats */}
            <div className="grid grid-cols-4 divide-x divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white text-center">
              <StructStat icon={TypeIcon} label="Hdr" value={headerType === 'none' ? '—' : headerType.toUpperCase().slice(0, 3)} />
              <StructStat icon={Hash} label="Body" value={`${body.length}`} />
              <StructStat icon={Variable} label="Vars" value={`${varList.length}`} />
              <StructStat icon={MessageSquare} label="Btns" value={`${buttons.length}`} />
            </div>

            {/* Variable inspector */}
            {varList.length > 0 && (
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    <Variable className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Sample values
                  </span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-600">
                    {varList.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {varList.map((v) => (
                    <li key={v} className="flex items-center gap-2">
                      <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white font-mono text-[10.5px] font-semibold text-zinc-700">
                        {`{{${v}}}`}
                      </span>
                      <Input
                        value={variableValues[v] ?? ''}
                        onChange={(e) => setVariableValues({ ...variableValues, [v]: e.target.value })}
                        placeholder={`Sample for {{${v}}}`}
                        className="h-7 text-[12px]"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation */}
            <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Policy checks
                </span>
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {checks.filter((c) => c.ok).length} / {checks.length}
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {checks.map((c, i) => {
                  const Icon = c.ok ? CircleCheck : c.severity === 'error' ? CircleX : TriangleAlert;
                  const color = c.ok
                    ? 'text-emerald-600'
                    : c.severity === 'error'
                    ? 'text-rose-600'
                    : 'text-amber-600';
                  return (
                    <li key={i} className="flex items-start gap-2 py-1.5 text-[11.5px]">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={2.25} aria-hidden />
                      <span className={c.ok ? 'text-zinc-600' : 'text-zinc-900'}>{c.label}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 border-t border-zinc-100 pt-2 text-[11px]">
                {errors > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                    <CircleX className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {errors} blocking
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Ready
                  </span>
                )}
                {warnings > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <TriangleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {warnings} warn
                  </span>
                )}
              </div>
            </div>

            {activeProject?.name && (
              <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Project: {activeProject.name}
              </p>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save template</ZoruDialogTitle>
            <ZoruDialogDescription>
              The template JSON payload will be copied to your clipboard, and a new version will be
              saved to your history. Paste it into your Meta Business Manager (or the Templates page)
              to submit it for approval.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy JSON and save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Version history</ZoruDialogTitle>
            <ZoruDialogDescription>
              Restore a previously saved version of this template.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="mt-4 flex max-h-[300px] flex-col gap-2 overflow-y-auto">
            {versions.length === 0 ? (
              <p className="text-[13px] text-zinc-500">
                No versions saved yet. Save your template to create a version.
              </p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900">{v.name}</p>
                    <p className="text-[11.5px] text-zinc-500">{fmtDate(v.timestamp)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadVersion(v)}>
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setVersionsOpen(false)}>
              Close
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

function StructStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="px-2 py-2.5">
      <Icon className="mx-auto h-3 w-3 text-zinc-500" strokeWidth={2.25} aria-hidden />
      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-500">{label}</p>
    </div>
  );
}

