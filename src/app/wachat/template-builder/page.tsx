"use client";
import { fmtDate } from "@/lib/utils";

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  cn,
  useZoruToast,
} from "@/components/zoruui";
import { memo, useMemo, useState } from "react";
import { Plus, Eye, Copy, Trash2, GripVertical, History } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useProject } from "@/context/project-context";

type HeaderType = "none" | "text" | "image" | "video" | "document";
type BtnType = "quick_reply" | "url" | "phone";

interface TplButton {
  type: BtnType;
  text: string;
  value: string;
}

const SortableBlock = memo(
  ({ id, children }: { id: string; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : 1,
      opacity: isDragging ? 0.6 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} className="relative group">
        <div
          {...attributes}
          {...listeners}
          className="absolute left-[-28px] top-6 p-1 cursor-grab text-zoru-ink-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-zoru-ink"
        >
          <GripVertical size={18} />
        </div>
        {children}
      </div>
    );
  },
);
SortableBlock.displayName = "SortableBlock";

export default function TemplateBuilderPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();

  const [category, setCategory] = useState("marketing");
  const [headerType, setHeaderType] = useState<HeaderType>("none");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState(
    "Hello {{1}}, your order {{2}} is confirmed!",
  );
  const [footer, setFooter] = useState("Powered by Wachat");
  const [buttons, setButtons] = useState<TplButton[]>([]);

  const [blocks, setBlocks] = useState([
    "category",
    "header",
    "body",
    "footer",
    "buttons",
  ]);

  const [saveOpen, setSaveOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const [versions, setVersions] = useState<
    { id: string; name: string; timestamp: number; state: any }[]
  >([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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
      setButtons((p) => [...p, { type: "quick_reply", text: "", value: "" }]);
  };
  const updateButton = (i: number, patch: Partial<TplButton>) =>
    setButtons((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeButton = (i: number) =>
    setButtons((p) => p.filter((_, idx) => idx !== i));

  const buildPayload = () => {
    const components: any[] = [];
    if (headerType === "text" && headerText)
      components.push({ type: "HEADER", format: "TEXT", text: headerText });
    else if (headerType !== "none")
      components.push({ type: "HEADER", format: headerType.toUpperCase() });
    components.push({ type: "BODY", text: body });
    if (footer) components.push({ type: "FOOTER", text: footer });
    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((b) => ({
          type: b.type === "quick_reply" ? "QUICK_REPLY" : b.type.toUpperCase(),
          text: b.text,
          ...(b.type !== "quick_reply" ? { [b.type]: b.value } : {}),
        })),
      });
    }
    return {
      name: `template_${Date.now()}`,
      category: category.toUpperCase(),
      language: "en_US",
      components,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);

    // Save version
    const newState = {
      category,
      headerType,
      headerText,
      body,
      footer,
      buttons,
      blocks,
    };
    const newVersion = {
      id: `v_${Date.now()}`,
      name: `Version ${versions.length + 1}`,
      timestamp: Date.now(),
      state: newState,
    };
    setVersions((prev) => [newVersion, ...prev]);

    await navigator.clipboard.writeText(json);
    toast({
      title: "Template JSON copied & Version saved",
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

    toast({
      title: "Version loaded",
      description: `Loaded ${ver.name}`,
    });
    setVersionsOpen(false);
  };

  const categoryBlock = useMemo(
    () => (
      <Card>
        <ZoruCardContent className="space-y-3 pt-6">
          <h2 className="text-[15px] font-semibold text-zoru-ink">Category</h2>
          <Select value={category} onValueChange={setCategory}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="marketing">Marketing</ZoruSelectItem>
              <ZoruSelectItem value="utility">Utility</ZoruSelectItem>
              <ZoruSelectItem value="authentication">
                Authentication
              </ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
        </ZoruCardContent>
      </Card>
    ),
    [category],
  );

  const headerBlock = useMemo(
    () => (
      <Card>
        <ZoruCardContent className="space-y-3 pt-6">
          <h2 className="text-[15px] font-semibold text-zoru-ink">Header</h2>
          <div className="flex flex-wrap gap-2">
            {(["none", "text", "image", "video", "document"] as const).map(
              (t) => {
                const isActive = headerType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHeaderType(t)}
                    className={cn(
                      "rounded-[var(--zoru-radius)] border px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
                      isActive
                        ? "border-zoru-ink bg-zoru-ink text-zoru-on-primary"
                        : "border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink",
                    )}
                  >
                    {t}
                  </button>
                );
              },
            )}
          </div>
          {headerType === "text" && (
            <Input
              placeholder="Header text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
            />
          )}
          {(headerType === "image" ||
            headerType === "video" ||
            headerType === "document") && (
            <p className="text-[12px] text-zoru-ink-muted">
              Upload {headerType} when submitting for approval.
            </p>
          )}
        </ZoruCardContent>
      </Card>
    ),
    [headerType, headerText],
  );

  const bodyBlock = useMemo(
    () => (
      <Card>
        <ZoruCardContent className="space-y-3 pt-6">
          <h2 className="text-[15px] font-semibold text-zoru-ink">Body</h2>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message body…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-zoru-ink-muted">Variables:</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => insertVar(n)}
                className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2 py-1 font-mono text-[11px] text-zoru-ink hover:bg-zoru-surface"
              >{`{{${n}}}`}</button>
            ))}
          </div>
        </ZoruCardContent>
      </Card>
    ),
    [body],
  );

  const footerBlock = useMemo(
    () => (
      <Card>
        <ZoruCardContent className="space-y-3 pt-6">
          <h2 className="text-[15px] font-semibold text-zoru-ink">Footer</h2>
          <Input
            placeholder="Footer text (optional)"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
        </ZoruCardContent>
      </Card>
    ),
    [footer],
  );

  const buttonsBlock = useMemo(
    () => (
      <Card>
        <ZoruCardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-zoru-ink">
              Buttons ({buttons.length}/3)
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={addButton}
              disabled={buttons.length >= 3}
            >
              <Plus /> Add
            </Button>
          </div>
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
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
                    <ZoruSelectItem value="quick_reply">
                      Quick reply
                    </ZoruSelectItem>
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
              {btn.type !== "quick_reply" && (
                <Input
                  className="min-w-[120px] flex-1"
                  placeholder={btn.type === "url" ? "https://…" : "+1234567890"}
                  value={btn.value}
                  onChange={(e) => updateButton(i, { value: e.target.value })}
                />
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove button"
                onClick={() => removeButton(i)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </ZoruCardContent>
      </Card>
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

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/templates">
              Templates
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Template builder</ZoruPageTitle>
          <ZoruPageDescription>
            Build WhatsApp message templates visually. Save copies the JSON
            payload to your clipboard for submission.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4 pl-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((id) => (
                <SortableBlock key={id} id={id}>
                  {blockMap[id]}
                </SortableBlock>
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex gap-4">
            <Button onClick={() => setSaveOpen(true)}>
              <Copy /> Save template (copy JSON)
            </Button>
            <Button variant="secondary" onClick={() => setVersionsOpen(true)}>
              <History /> Versions ({versions.length})
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card variant="elevated">
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-zoru-ink">
                <Eye className="h-4 w-4" /> Preview
              </h2>
              <div className="rounded-[var(--zoru-radius-lg)] bg-zoru-surface p-4">
                <div className="max-w-[260px] rounded-[var(--zoru-radius)] bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)]">
                  {blocks.map((blockId) => {
                    if (blockId === "header" && headerType !== "none") {
                      return (
                        <div key={blockId} className="mb-2">
                          {headerType === "text" && headerText && (
                            <p className="mb-1 text-[13px] font-semibold text-zoru-ink">
                              {headerText}
                            </p>
                          )}
                          {headerType !== "text" && (
                            <div className="flex h-24 items-center justify-center rounded bg-zoru-surface-2 text-[11px] uppercase text-zoru-ink-subtle">
                              {headerType}
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (blockId === "body") {
                      return (
                        <p
                          key={blockId}
                          className="whitespace-pre-wrap text-[13px] text-zoru-ink mb-2"
                        >
                          {body || "Message body…"}
                        </p>
                      );
                    }
                    if (blockId === "footer" && footer) {
                      return (
                        <p
                          key={blockId}
                          className="mt-2 text-[11px] text-zoru-ink-muted"
                        >
                          {footer}
                        </p>
                      );
                    }
                    if (blockId === "buttons" && buttons.length > 0) {
                      return (
                        <div
                          key={blockId}
                          className="mt-2 flex flex-col gap-1 border-t border-zoru-line pt-2"
                        >
                          {buttons.map((b, i) => (
                            <div
                              key={i}
                              className="py-1 text-center text-[12px] font-medium text-zoru-ink"
                            >
                              {b.text || "Button"}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
              {activeProject?.name && (
                <Label className="block text-[10px] uppercase tracking-wide text-zoru-ink-subtle">
                  Project: {activeProject.name}
                </Label>
              )}
            </ZoruCardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save template</ZoruDialogTitle>
            <ZoruDialogDescription>
              The template JSON payload will be copied to your clipboard, and a
              new version will be saved to your history. Paste it into your Meta
              Business Manager (or the Templates page) to submit it for
              approval.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Copy /> Copy JSON & Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Version History</ZoruDialogTitle>
            <ZoruDialogDescription>
              Restore a previously saved version of this template.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mt-4">
            {versions.length === 0 ? (
              <p className="text-sm text-zoru-ink-muted">
                No versions saved yet. Save your template to create a version.
              </p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface"
                >
                  <div>
                    <p className="text-[14px] font-medium text-zoru-ink">
                      {v.name}
                    </p>
                    <p className="text-[12px] text-zoru-ink-muted">
                      {fmtDate(v.timestamp)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadVersion(v)}
                  >
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

      <div className="h-6" />
    </div>
  );
}
