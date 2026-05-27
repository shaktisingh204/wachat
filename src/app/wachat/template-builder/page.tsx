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
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  cn,
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

function BlockCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-zinc-900">{title}</h2>
      <div className="space-y-3">{children}</div>
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
    if (buttons.length < 3)
      setButtons((p) => [...p, { type: 'quick_reply', text: '', value: '' }]);
  };
  const updateButton = (i: number, patch: Partial<TplButton>) =>
    setButtons((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeButton = (i: number) => setButtons((p) => p.filter((_, idx) => idx !== i));

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
      <BlockCard title="Header">
        <div className="flex flex-wrap gap-2">
          {(['none', 'text', 'image', 'video', 'document'] as const).map((t) => {
            const isActive = headerType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setHeaderType(t)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.97]"
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
          <Input
            placeholder="Header text"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
          />
        )}
        {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
          <p className="text-[12px] text-zinc-500">
            Upload {headerType} when submitting for approval.
          </p>
        )}
      </BlockCard>
    ),
    [headerType, headerText],
  );

  const bodyBlock = useMemo(
    () => (
      <BlockCard title="Body">
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-zinc-500">Variables:</span>
          {[1, 2, 3].map((n) => (
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
      <BlockCard title="Footer">
        <Input
          placeholder="Footer text (optional)"
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
        />
      </BlockCard>
    ),
    [footer],
  );

  const buttonsBlock = useMemo(
    () => (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">
            Buttons ({buttons.length}/3)
          </h2>
          <WaButton
            size="sm"
            variant="outline"
            onClick={addButton}
            disabled={buttons.length >= 3}
            leftIcon={Plus}
          >
            Add
          </WaButton>
        </div>
        <div className="space-y-3">
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
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
                placeholder="Button label"
                value={btn.text}
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

  return (
    <WaPage>
      <PageHeader
        title="Template builder"
        description="Build WhatsApp message templates visually. Save copies the JSON payload to your clipboard for submission."
        kicker={activeProject?.name ? `Wachat · ${activeProject.name}` : 'Wachat · builder'}
        backHref="/wachat/templates"
        actions={
          <>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4 pl-8">
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

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PhoneFrame title={activeProject?.name ?? 'Wachat Business'} subtitle="online">
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
                      <p className="whitespace-pre-wrap">{body || 'Message body'}</p>
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
                      className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm"
                    >
                      {b.text || 'Button'}
                    </div>
                  ))}
                </m.div>
              )}
            </AnimatePresence>
          </PhoneFrame>
          {activeProject?.name && (
            <p className="mt-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Project: {activeProject.name}
            </p>
          )}
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
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div>
                    <p className="text-[13.5px] font-medium text-zinc-900">{v.name}</p>
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
