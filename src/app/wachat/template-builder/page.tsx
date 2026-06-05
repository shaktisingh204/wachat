"use client";
import { fmtDate } from "@/lib/utils";

import { WachatPage } from "@/app/wachat/_components/wachat-page";
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
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
          className="absolute left-[-28px] top-6 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--st-text-tertiary)" }}
        >
          <GripVertical size={18} aria-hidden="true" />
        </div>
        {children}
      </div>
    );
  },
);
SortableBlock.displayName = "SortableBlock";

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
        <div className="space-y-3">
          <h2
            className="text-[15px] font-semibold"
            style={{ color: "var(--st-text)" }}
          >
            Category
          </h2>
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
        </div>
      </Card>
    ),
    [category],
  );

  const headerBlock = useMemo(
    () => (
      <Card>
        <div className="space-y-3">
          <h2
            className="text-[15px] font-semibold"
            style={{ color: "var(--st-text)" }}
          >
            Header
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["none", "text", "image", "video", "document"] as const).map(
              (t) => {
                const isActive = headerType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHeaderType(t)}
                    aria-pressed={isActive}
                    className="px-3 py-1.5 text-[12px] font-medium capitalize transition-colors"
                    style={{
                      borderRadius: "var(--st-radius)",
                      border: "1px solid",
                      borderColor: isActive
                        ? "var(--st-text)"
                        : "var(--st-border)",
                      background: isActive ? "var(--st-text)" : "var(--st-bg)",
                      color: isActive
                        ? "var(--st-bg)"
                        : "var(--st-text-secondary)",
                    }}
                  >
                    {t}
                  </button>
                );
              },
            )}
          </div>
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
            <p
              className="text-[12px]"
              style={{ color: "var(--st-text-secondary)" }}
            >
              Upload {headerType} when submitting for approval.
            </p>
          )}
        </div>
      </Card>
    ),
    [headerType, headerText],
  );

  const bodyBlock = useMemo(
    () => (
      <Card>
        <div className="space-y-3">
          <h2
            className="text-[15px] font-semibold"
            style={{ color: "var(--st-text)" }}
          >
            Body
          </h2>
          <Field label="Body">
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body…"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[12px]"
              style={{ color: "var(--st-text-secondary)" }}
            >
              Variables:
            </span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => insertVar(n)}
                className="px-2 py-1 font-mono text-[11px]"
                style={{
                  borderRadius: "var(--st-radius)",
                  border: "1px solid var(--st-border)",
                  background: "var(--st-bg)",
                  color: "var(--st-text)",
                }}
              >{`{{${n}}}`}</button>
            ))}
          </div>
        </div>
      </Card>
    ),
    [body],
  );

  const footerBlock = useMemo(
    () => (
      <Card>
        <div className="space-y-3">
          <h2
            className="text-[15px] font-semibold"
            style={{ color: "var(--st-text)" }}
          >
            Footer
          </h2>
          <Field label="Footer text (optional)">
            <Input
              placeholder="Footer text (optional)"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
            />
          </Field>
        </div>
      </Card>
    ),
    [footer],
  );

  const buttonsBlock = useMemo(
    () => (
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              className="text-[15px] font-semibold"
              style={{ color: "var(--st-text)" }}
            >
              Buttons ({buttons.length}/3)
            </h2>
            <Button
              size="sm"
              variant="outline"
              iconLeft={Plus}
              onClick={addButton}
              disabled={buttons.length >= 3}
            >
              Add
            </Button>
          </div>
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 p-3"
              style={{
                borderRadius: "var(--st-radius)",
                border: "1px solid var(--st-border)",
                background: "var(--st-bg-secondary)",
              }}
            >
              <div className="min-w-[140px]">
                <Select
                  aria-label="Button type"
                  value={btn.type}
                  onChange={(v) =>
                    updateButton(i, { type: (v ?? "quick_reply") as BtnType })
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
                  aria-label={btn.type === "url" ? "Button URL" : "Button phone number"}
                  placeholder={btn.type === "url" ? "https://…" : "+1234567890"}
                  value={btn.value}
                  onChange={(e) => updateButton(i, { value: e.target.value })}
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
          ))}
        </div>
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
            <div className="space-y-3">
              <h2
                className="flex items-center gap-1.5 text-[15px] font-semibold"
                style={{ color: "var(--st-text)" }}
              >
                <Eye className="h-4 w-4" aria-hidden="true" /> Preview
              </h2>
              <div
                className="p-4"
                style={{
                  borderRadius: "var(--st-radius-lg)",
                  background: "var(--st-bg-secondary)",
                }}
              >
                <div
                  className="max-w-[260px] p-3"
                  style={{
                    borderRadius: "var(--st-radius)",
                    background: "var(--st-bg)",
                    boxShadow: "var(--st-shadow-sm)",
                  }}
                >
                  {blocks.map((blockId) => {
                    if (blockId === "header" && headerType !== "none") {
                      return (
                        <div key={blockId} className="mb-2">
                          {headerType === "text" && headerText && (
                            <p
                              className="mb-1 text-[13px] font-semibold"
                              style={{ color: "var(--st-text)" }}
                            >
                              {headerText}
                            </p>
                          )}
                          {headerType !== "text" && (
                            <div
                              className="flex h-24 items-center justify-center text-[11px] uppercase"
                              style={{
                                borderRadius: "var(--st-radius)",
                                background: "var(--st-bg-muted)",
                                color: "var(--st-text-tertiary)",
                              }}
                            >
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
                          className="whitespace-pre-wrap text-[13px] mb-2"
                          style={{ color: "var(--st-text)" }}
                        >
                          {body || "Message body…"}
                        </p>
                      );
                    }
                    if (blockId === "footer" && footer) {
                      return (
                        <p
                          key={blockId}
                          className="mt-2 text-[11px]"
                          style={{ color: "var(--st-text-secondary)" }}
                        >
                          {footer}
                        </p>
                      );
                    }
                    if (blockId === "buttons" && buttons.length > 0) {
                      return (
                        <div
                          key={blockId}
                          className="mt-2 flex flex-col gap-1 pt-2"
                          style={{ borderTop: "1px solid var(--st-border)" }}
                        >
                          {buttons.map((b, i) => (
                            <div
                              key={i}
                              className="py-1 text-center text-[12px] font-medium"
                              style={{ color: "var(--st-text)" }}
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
                <p
                  className="block text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--st-text-tertiary)" }}
                >
                  Project: {activeProject.name}
                </p>
              )}
            </div>
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
            <p
              className="text-sm"
              style={{ color: "var(--st-text-secondary)" }}
            >
              No versions saved yet. Save your template to create a version.
            </p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3"
                style={{
                  borderRadius: "var(--st-radius)",
                  border: "1px solid var(--st-border)",
                  background: "var(--st-bg-secondary)",
                }}
              >
                <div>
                  <p
                    className="text-[14px] font-medium"
                    style={{ color: "var(--st-text)" }}
                  >
                    {v.name}
                  </p>
                  <p
                    className="text-[12px]"
                    style={{ color: "var(--st-text-secondary)" }}
                  >
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
      </Modal>
    </WachatPage>
  );
}
