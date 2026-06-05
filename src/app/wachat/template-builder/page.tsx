"use client";
import { fmtDate } from "@/lib/utils";

import { WachatPage } from "@/app/wachat/_components/wachat-page";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardDescription,
  EmptyState,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";
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

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(" ");
}

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

    // transform/transition/zIndex/opacity are genuine dynamic layout values — keep inline
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
          aria-label="Drag to reorder block"
          className="absolute left-[-28px] top-6 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[var(--st-text-tertiary)]"
        >
          <GripVertical size={18} aria-hidden="true" />
        </div>
        {children}
      </div>
    );
  },
);
SortableBlock.displayName = "SortableBlock";

const HEADER_TYPE_OPTIONS = (
  ["none", "text", "image", "video", "document"] as const
).map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));

export default function TemplateBuilderPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

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
      tone: "success",
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
        <CardHeader>
          <CardTitle>Category</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Category">
            <Select
              value={category}
              onChange={(v) => setCategory(v ?? "marketing")}
              options={[
                { value: "marketing", label: "Marketing" },
                { value: "utility", label: "Utility" },
                { value: "authentication", label: "Authentication" },
              ]}
            />
          </Field>
        </CardBody>
      </Card>
    ),
    [category],
  );

  const headerBlock = useMemo(
    () => (
      <Card>
        <CardHeader>
          <CardTitle>Header</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <SegmentedControl
            aria-label="Header type"
            value={headerType}
            onChange={(v) => setHeaderType(v as HeaderType)}
            items={HEADER_TYPE_OPTIONS}
          />
          {headerType === "text" && (
            <Field label="Header text">
              <Input
                placeholder="Header text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            </Field>
          )}
          {(headerType === "image" ||
            headerType === "video" ||
            headerType === "document") && (
            <CardDescription>
              Upload {headerType} when submitting for approval.
            </CardDescription>
          )}
        </CardBody>
      </Card>
    ),
    [headerType, headerText],
  );

  const bodyBlock = useMemo(
    () => (
      <Card>
        <CardHeader>
          <CardTitle>Body</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Body">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body..."
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <CardDescription className="!mb-0">Variables:</CardDescription>
            {[1, 2, 3].map((n) => (
              <Button
                key={n}
                variant="outline"
                size="sm"
                onClick={() => insertVar(n)}
              >
                {`{{${n}}}`}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    ),
    [body],
  );

  const footerBlock = useMemo(
    () => (
      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Footer text (optional)">
            <Input
              placeholder="Footer text (optional)"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
            />
          </Field>
        </CardBody>
      </Card>
    ),
    [footer],
  );

  const buttonsBlock = useMemo(
    () => (
      <Card>
        <CardHeader>
          <CardTitle>Buttons ({buttons.length}/3)</CardTitle>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={addButton}
            disabled={buttons.length >= 3}
          >
            Add
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {buttons.map((btn, i) => (
            <Card key={i} variant="ghost" padding="sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[140px]">
                  <Select
                    aria-label="Button type"
                    value={btn.type}
                    onChange={(v) =>
                      updateButton(i, {
                        type: (v ?? "quick_reply") as BtnType,
                      })
                    }
                    options={[
                      { value: "quick_reply", label: "Quick reply" },
                      { value: "url", label: "URL" },
                      { value: "phone", label: "Phone" },
                    ]}
                  />
                </div>
                <Input
                  className="min-w-[120px] flex-1"
                  aria-label="Button label"
                  placeholder="Button label"
                  value={btn.text}
                  onChange={(e) => updateButton(i, { text: e.target.value })}
                />
                {btn.type !== "quick_reply" && (
                  <Input
                    className="min-w-[120px] flex-1"
                    aria-label={
                      btn.type === "url" ? "Button URL" : "Button phone number"
                    }
                    placeholder={
                      btn.type === "url" ? "https://..." : "+1234567890"
                    }
                    value={btn.value}
                    onChange={(e) =>
                      updateButton(i, { value: e.target.value })
                    }
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  aria-label="Remove button"
                  onClick={() => removeButton(i)}
                />
              </div>
            </Card>
          ))}
        </CardBody>
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
    <WachatPage
      breadcrumb={[
        { label: "SabNode", href: "/dashboard" },
        { label: "WaChat", href: "/wachat" },
        { label: "Templates", href: "/wachat/templates" },
        { label: "Builder" },
      ]}
      title="Template builder"
      description="Build WhatsApp message templates visually. Save copies the JSON payload to your clipboard for submission."
    >
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
            <Button
              variant="primary"
              iconLeft={Copy}
              onClick={() => setSaveOpen(true)}
            >
              Save template (copy JSON)
            </Button>
            <Button
              variant="secondary"
              iconLeft={History}
              onClick={() => setVersionsOpen(true)}
            >
              Versions ({versions.length})
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" aria-hidden="true" /> Preview
              </CardTitle>
              {activeProject?.name && (
                <CardDescription className="text-[10px] uppercase tracking-wide">
                  Project: {activeProject.name}
                </CardDescription>
              )}
            </CardHeader>
            <CardBody>
              {/* Preview bubble -- rounded-2xl is a bubble shape, kept as-is */}
              <div className="rounded-2xl p-4 bg-[var(--st-bg-secondary)]">
                <div className="max-w-[260px] rounded-[var(--st-radius)] p-3 bg-[var(--st-bg)] shadow-[var(--st-shadow-sm)]">
                  {blocks.map((blockId) => {
                    if (blockId === "header" && headerType !== "none") {
                      return (
                        <div key={blockId} className="mb-2">
                          {headerType === "text" && headerText && (
                            <p className="mb-1 text-[13px] font-semibold text-[var(--st-text)]">
                              {headerText}
                            </p>
                          )}
                          {headerType !== "text" && (
                            <div className="flex h-24 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[11px] uppercase text-[var(--st-text-tertiary)]">
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
                          className="whitespace-pre-wrap text-[13px] mb-2 text-[var(--st-text)]"
                        >
                          {body || "Message body..."}
                        </p>
                      );
                    }
                    if (blockId === "footer" && footer) {
                      return (
                        <p
                          key={blockId}
                          className="mt-2 text-[11px] text-[var(--st-text-secondary)]"
                        >
                          {footer}
                        </p>
                      );
                    }
                    if (blockId === "buttons" && buttons.length > 0) {
                      return (
                        <div
                          key={blockId}
                          className="mt-2 flex flex-col gap-1 pt-2 border-t border-[var(--st-border)]"
                        >
                          {buttons.map((b, i) => (
                            <div
                              key={i}
                              className="py-1 text-center text-[12px] font-medium text-[var(--st-text)]"
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
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save template"
        description="The template JSON payload will be copied to your clipboard, and a new version will be saved to your history. Paste it into your Meta Business Manager (or the Templates page) to submit it for approval."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Copy} onClick={handleSave}>
              Copy JSON & Save
            </Button>
          </>
        }
      />

      <Modal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        title="Version History"
        description="Restore a previously saved version of this template."
        footer={
          <Button variant="ghost" onClick={() => setVersionsOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {versions.length === 0 ? (
            <EmptyState
              icon={History}
              size="sm"
              title="No versions yet"
              description="Save your template to create a version."
            />
          ) : (
            versions.map((v) => (
              <Card key={v.id} variant="outlined" padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-[var(--st-text)]">
                      {v.name}
                    </p>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
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
              </Card>
            ))
          )}
        </div>
      </Modal>
    </WachatPage>
  );
}
