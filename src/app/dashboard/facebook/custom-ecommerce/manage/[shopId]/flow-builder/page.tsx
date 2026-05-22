"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruFileInput,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetTitle,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  BookOpen,
  Bot,
  Clock,
  File as FileIcon,
  Frame,
  GitFork,
  ImageIcon,
  LoaderCircle,
  Maximize,
  MessageSquare,
  Minimize,
  PackageCheck,
  PanelLeft,
  Play,
  Plus,
  Save,
  Settings2,
  ShoppingCart,
  ToggleRight,
  Trash2,
  Type,
  View,
  ZoomIn,
  ZoomOut,
  } from "lucide-react";

import { getEcommShopById } from "@/app/actions/custom-ecommerce.actions";
import {
  deleteEcommFlow,
  getEcommFlowById,
  getEcommFlows,
  saveEcommFlow,
  } from "@/app/actions/custom-ecommerce-flow.actions";
import type {
  EcommFlow,
  EcommFlowEdge,
  EcommFlowNode,
  EcommShop,
  } from "@/lib/definitions";
import type { WithId } from "mongodb";
import { cn } from "@/lib/utils";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder
 *
 * Conversational flow-builder shell. Same canvas runtime, same handlers,
 * same data flow as the legacy page — only the visual chrome (header,
 * save bar, blocks/flows sidebar, properties panel, mobile sheets) was
 * rebuilt on top of zoru primitives.
 *
 * TODO(meta-zoru phase 7): the canvas itself (node renderer, edge SVG,
 * pan/zoom math) is intentionally preserved as an opaque internal — the
 * interaction layer is too large to refactor as part of this phase. A
 * follow-up batch should also restyle the per-node card visuals.
 */

import * as React from "react";

import { SabFileUrlInput } from "@/components/sabfiles";

type NodeType =
  | "start"
  | "text"
  | "buttons"
  | "input"
  | "image"
  | "delay"
  | "condition"
  | "carousel"
  | "addToCart"
  | "orderConfirmation"
  | "api";

type ButtonConfig = {
  id: string;
  text: string;
  type?: string;
};

type CarouselElementButton = {
  type: "web_url" | "postback";
  title: string;
  url?: string;
  payload?: string;
  webview_height_ratio?: "compact" | "tall" | "full";
  messenger_extensions?: boolean;
};

type CarouselElement = {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  buttons?: CarouselElementButton[];
};

const blockTypes = [
  { type: "text", label: "Send message", icon: MessageSquare },
  { type: "image", label: "Send image", icon: ImageIcon },
  { type: "buttons", label: "Add quick replies", icon: ToggleRight },
  { type: "carousel", label: "Product carousel", icon: View },
  { type: "input", label: "Get user input", icon: Type },
  { type: "delay", label: "Add delay", icon: Clock },
  { type: "condition", label: "Add condition", icon: GitFork },
  { type: "api", label: "Call API", icon: ArrowRightLeft },
  { type: "addToCart", label: "Add to cart", icon: ShoppingCart },
  { type: "orderConfirmation", label: "Order confirmation", icon: PackageCheck },
] as const;

// ──────────────────────────────────────────────────────────────────────
// Node preview (used inside the canvas card body)
// ──────────────────────────────────────────────────────────────────────
function NodePreview({ node }: { node: EcommFlowNode }) {
  const renderTextWithVariables = (text?: string) => {
    if (!text)
      return (
        <span className="italic text-zoru-ink-subtle">Enter message…</span>
      );
    const parts = text.split(/({{\s*[\w\d._]+\s*}})/g);
    return parts.map((part, i) =>
      part.match(/^{{.*}}$/) ? (
        <span
          key={i}
          className="rounded-sm bg-zoru-surface-2 px-1 font-medium text-zoru-ink"
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const previewContent = (() => {
    switch (node.type) {
      case "text":
      case "input":
      case "orderConfirmation":
        return (
          <p className="whitespace-pre-wrap">
            {renderTextWithVariables(node.data.text)}
          </p>
        );
      case "image":
        return (
          <div className="space-y-1">
            <div className="flex aspect-video w-full items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-bg/50">
              <ImageIcon className="h-8 w-8 text-zoru-ink-subtle" />
            </div>
            {node.data.caption ? (
              <p className="whitespace-pre-wrap text-xs">
                {renderTextWithVariables(node.data.caption)}
              </p>
            ) : null}
          </div>
        );
      case "buttons":
        return (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap">
              {renderTextWithVariables(node.data.text)}
            </p>
            <div className="mt-2 space-y-1 border-t border-zoru-line pt-2">
              {(node.data.buttons || []).map(
                (btn: ButtonConfig, index: number) => (
                  <div
                    key={btn.id || index}
                    className="rounded-[var(--zoru-radius-sm)] bg-zoru-bg/50 py-1.5 text-center text-xs text-zoru-ink"
                  >
                    {btn.text || `Button ${index + 1}`}
                  </div>
                ),
              )}
            </div>
          </div>
        );
      case "carousel": {
        const elementCount = node.data.elements?.length || 0;
        return (
          <p className="text-xs italic text-zoru-ink-muted">
            Sends a carousel with {elementCount} card(s).
          </p>
        );
      }
      case "addToCart":
        return (
          <p className="text-xs italic text-zoru-ink-muted">
            Adds &ldquo;{node.data.productName || "product"}&rdquo; to cart.
          </p>
        );
      default:
        return null;
    }
  })();

  if (!previewContent) return null;

  return (
    <ZoruCardContent className="p-2 pt-0">
      <div className="rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-2 text-sm text-zoru-ink">
        {previewContent}
      </div>
    </ZoruCardContent>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Node component (canvas-positioned card with handles)
// ──────────────────────────────────────────────────────────────────────
function NodeComponent({
  node,
  onSelectNode,
  isSelected,
  onNodeMouseDown,
  onHandleClick,
}: {
  node: EcommFlowNode;
  onSelectNode: (id: string) => void;
  isSelected: boolean;
  onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onHandleClick: (
    e: React.MouseEvent,
    nodeId: string,
    handleId: string,
  ) => void;
}) {
  const meta = [
    ...blockTypes,
    { type: "start", label: "Start", icon: Play },
  ].find((b) => b.type === node.type);
  const BlockIcon = meta?.icon ?? MessageSquare;

  const Handle = ({
    id,
    style,
  }: {
    id: string;
    position: "left" | "right" | "top" | "bottom";
    style?: React.CSSProperties;
  }) => (
    <div
      id={id}
      style={style}
      className="absolute z-10 h-4 w-4 rounded-full border-2 border-zoru-ink bg-zoru-bg transition-colors hover:bg-zoru-ink"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onHandleClick(e, node.id, id);
      }}
    />
  );

  return (
    <div
      className="absolute cursor-grab transition-all active:cursor-grabbing"
      style={{ top: node.position.y, left: node.position.x }}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectNode(node.id);
      }}
    >
      <Card
        className={cn(
          "w-64 hover:-translate-y-0.5 hover:shadow-[var(--zoru-shadow-md)]",
          isSelected && "ring-2 ring-zoru-ink",
        )}
      >
        <ZoruCardHeader className="flex flex-row items-center gap-3 p-3">
          <BlockIcon className="h-5 w-5 text-zoru-ink-muted" />
          <ZoruCardTitle className="text-sm">
            {node.data.label}
          </ZoruCardTitle>
        </ZoruCardHeader>
        <NodePreview node={node} />
        {node.type === "condition" ? (
          <ZoruCardContent className="p-3 pt-0 text-xs text-zoru-ink-muted">
            <div className="flex items-center justify-between">
              <span>Yes</span>
            </div>
            <Separator className="my-1" />
            <div className="flex items-center justify-between">
              <span>No</span>
            </div>
          </ZoruCardContent>
        ) : null}
      </Card>

      {node.type !== "start" ? (
        <Handle
          position="left"
          id={`${node.id}-input`}
          style={{
            top: "50%",
            transform: "translateY(-50%)",
            left: "-0.5rem",
          }}
        />
      ) : null}

      {node.type === "condition" ? (
        <>
          <Handle
            position="right"
            id={`${node.id}-output-yes`}
            style={{
              top: "33.33%",
              transform: "translateY(-50%)",
              right: "-0.5rem",
            }}
          />
          <Handle
            position="right"
            id={`${node.id}-output-no`}
            style={{
              top: "66.67%",
              transform: "translateY(-50%)",
              right: "-0.5rem",
            }}
          />
        </>
      ) : node.type === "buttons" ? (
        (node.data.buttons || []).map(
          (btn: ButtonConfig, index: number) => {
            const totalButtons = (node.data.buttons || []).length;
            const topPosition =
              totalButtons > 1
                ? `${(100 / (totalButtons + 1)) * (index + 1)}%`
                : "50%";
            return (
              <Handle
                key={btn.id || index}
                position="right"
                id={`${node.id}-btn-${index}`}
                style={{
                  top: topPosition,
                  transform: "translateY(-50%)",
                  right: "-0.5rem",
                }}
              />
            );
          },
        )
      ) : node.type !== "addToCart" ? (
        <Handle
          position="right"
          id={`${node.id}-output-main`}
          style={{
            top: "50%",
            transform: "translateY(-50%)",
            right: "-0.5rem",
          }}
        />
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Properties panel
// ──────────────────────────────────────────────────────────────────────
function PropertiesPanel({
  selectedNode,
  updateNodeData,
  deleteNode,
}: {
  selectedNode: EcommFlowNode | null;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  deleteNode: (id: string) => void;
}) {
  const { toast } = useZoruToast();
  if (!selectedNode) return null;

  const handleDataChange = (field: string, value: unknown) => {
    updateNodeData(selectedNode.id, { [field]: value });
  };

  const handleButtonChange = (
    index: number,
    field: "text",
    value: string,
  ) => {
    const newButtons: ButtonConfig[] = [...(selectedNode.data.buttons || [])];
    newButtons[index] = { ...newButtons[index], [field]: value };
    handleDataChange("buttons", newButtons);
  };

  const addFlowButton = () => {
    const currentButtons: ButtonConfig[] = selectedNode.data.buttons || [];
    if (currentButtons.length >= 13) {
      toast({
        title: "Limit reached",
        description: "You can add a maximum of 13 quick replies.",
        variant: "destructive",
      });
      return;
    }
    const newButtons: ButtonConfig[] = [
      ...currentButtons,
      { id: `btn-${Date.now()}`, text: "", type: "text" },
    ];
    handleDataChange("buttons", newButtons);
  };

  const removeFlowButton = (index: number) => {
    const newButtons = (selectedNode.data.buttons || []).filter(
      (_: ButtonConfig, i: number) => i !== index,
    );
    handleDataChange("buttons", newButtons);
  };

  const handleElementChange = (
    elementId: string,
    field: keyof CarouselElement,
    value: string,
  ) => {
    const newElements = (selectedNode.data.elements || []).map(
      (el: CarouselElement) =>
        el.id === elementId ? { ...el, [field]: value } : el,
    );
    handleDataChange("elements", newElements);
  };

  const handleElementButtonChange = (
    elementId: string,
    buttonIndex: number,
    field: keyof CarouselElementButton,
    value: unknown,
  ) => {
    const newElements = (selectedNode.data.elements || []).map(
      (el: CarouselElement) => {
        if (el.id === elementId) {
          const newButtons = [...(el.buttons || [])];
          newButtons[buttonIndex] = {
            ...newButtons[buttonIndex],
            [field]: value,
          };
          return { ...el, buttons: newButtons };
        }
        return el;
      },
    );
    handleDataChange("elements", newElements);
  };

  const addElement = () => {
    const currentElements: CarouselElement[] =
      selectedNode.data.elements || [];
    if (currentElements.length >= 10) {
      toast({
        title: "Limit reached",
        description: "A carousel can have a maximum of 10 cards.",
        variant: "destructive",
      });
      return;
    }
    const newElements = [
      ...currentElements,
      { id: `el-${Date.now()}`, title: "New card", buttons: [] },
    ];
    handleDataChange("elements", newElements);
  };

  const removeElement = (elementId: string) => {
    const newElements = (selectedNode.data.elements || []).filter(
      (el: CarouselElement) => el.id !== elementId,
    );
    handleDataChange("elements", newElements);
  };

  const addElementButton = (
    elementId: string,
    type: "web_url" | "postback",
  ) => {
    const newElements = (selectedNode.data.elements || []).map(
      (el: CarouselElement) => {
        if (el.id === elementId) {
          const currentButtons = el.buttons || [];
          if (currentButtons.length >= 3) {
            toast({
              title: "Limit reached",
              description: "A card can have a maximum of 3 buttons.",
              variant: "destructive",
            });
            return el;
          }
          const newButtons: CarouselElementButton[] = [
            ...currentButtons,
            { type, title: "New button" },
          ];
          return { ...el, buttons: newButtons };
        }
        return el;
      },
    );
    handleDataChange("elements", newElements);
  };

  const removeElementButton = (elementId: string, buttonIndex: number) => {
    const newElements = (selectedNode.data.elements || []).map(
      (el: CarouselElement) => {
        if (el.id === elementId) {
          const newButtons = (el.buttons || []).filter(
            (_, i) => i !== buttonIndex,
          );
          return { ...el, buttons: newButtons };
        }
        return el;
      },
    );
    handleDataChange("elements", newElements);
  };

  const handleApiChange = (field: string, value: unknown) => {
    const currentApiRequest = selectedNode.data.apiRequest || {};
    handleDataChange("apiRequest", { ...currentApiRequest, [field]: value });
  };

  const handleMappingChange = (
    index: number,
    field: "variable" | "path",
    value: string,
  ) => {
    const mappings = [
      ...(selectedNode.data.apiRequest?.responseMappings || []),
    ];
    mappings[index] = { ...mappings[index], [field]: value };
    handleApiChange("responseMappings", mappings);
  };

  const addMapping = () => {
    const mappings = [
      ...(selectedNode.data.apiRequest?.responseMappings || []),
      { variable: "", path: "" },
    ];
    handleApiChange("responseMappings", mappings);
  };

  const removeMapping = (index: number) => {
    const mappings = (
      selectedNode.data.apiRequest?.responseMappings || []
    ).filter((_: unknown, i: number) => i !== index);
    handleApiChange("responseMappings", mappings);
  };

  const renderProperties = () => {
    switch (selectedNode.type) {
      case "start":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="triggerKeywords">
                Trigger keywords
              </Label>
              <Input
                id="triggerKeywords"
                placeholder="e.g., help, menu"
                value={selectedNode.data.triggerKeywords || ""}
                onChange={(e) =>
                  handleDataChange("triggerKeywords", e.target.value)
                }
              />
              <p className="text-xs text-zoru-ink-muted">
                Comma-separated keywords to start this flow.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line p-4">
              <div>
                <Label htmlFor="isWelcomeFlow">
                  Set as welcome flow
                </Label>
                <p className="text-xs text-zoru-ink-muted">
                  Automatically triggers for new users.
                </p>
              </div>
              <Switch
                id="isWelcomeFlow"
                checked={selectedNode.data.isWelcomeFlow}
                onCheckedChange={(checked: boolean) =>
                  handleDataChange("isWelcomeFlow", checked)
                }
              />
            </div>
          </div>
        );
      case "text":
        return (
          <Textarea
            id="text-content"
            placeholder="Enter your message here…"
            value={selectedNode.data.text || ""}
            onChange={(e) => handleDataChange("text", e.target.value)}
            className="h-32"
          />
        );
      case "orderConfirmation":
        return (
          <div className="space-y-1.5">
            <Label htmlFor="confirmation-text">
              Confirmation message
            </Label>
            <Textarea
              id="confirmation-text"
              placeholder="Thank you for your order, {{name}}!"
              defaultValue={
                selectedNode.data.text ||
                "Thank you for your order, {{name}}! Your order ID is #{{order_id}}."
              }
              onChange={(e) => handleDataChange("text", e.target.value)}
              className="h-32"
            />
            <p className="text-xs text-zoru-ink-muted">
              Use variables like {"`{{order_id}}`"} which you should get from
              a preceding API call block.
            </p>
          </div>
        );
      case "image":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="image-url">Image URL</Label>
              <SabFileUrlInput
                id="image-url"
                accept="image"
                placeholder="https://example.com/image.png"
                value={selectedNode.data.imageUrl || ""}
                onChange={(v) => handleDataChange("imageUrl", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="image-caption">Caption (optional)</Label>
              <Textarea
                id="image-caption"
                placeholder="A caption for your image…"
                value={selectedNode.data.caption || ""}
                onChange={(e) => handleDataChange("caption", e.target.value)}
              />
            </div>
          </div>
        );
      case "buttons":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="buttons-text">Message text</Label>
              <Textarea
                id="buttons-text"
                placeholder="Choose an option:"
                value={selectedNode.data.text || ""}
                onChange={(e) => handleDataChange("text", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Quick replies</Label>
              <div className="space-y-3">
                {(selectedNode.data.buttons || []).map(
                  (btn: ButtonConfig, index: number) => (
                    <div
                      key={btn.id || index}
                      className="flex items-center gap-2"
                    >
                      <Input
                        placeholder="Button text"
                        value={btn.text}
                        onChange={(e) =>
                          handleButtonChange(index, "text", e.target.value)
                        }
                        maxLength={20}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeFlowButton(index)}
                        aria-label="Remove button"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ),
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                block
                className="mt-2"
                onClick={addFlowButton}
              >
                <Plus />
                Add quick reply
              </Button>
            </div>
          </div>
        );
      case "input":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="input-text">Question to ask</Label>
              <Textarea
                id="input-text"
                placeholder="e.g., What is your name?"
                value={selectedNode.data.text || ""}
                onChange={(e) => handleDataChange("text", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="input-variable">
                Save answer to variable
              </Label>
              <Input
                id="input-variable"
                placeholder="e.g., user_name"
                value={selectedNode.data.variableToSave || ""}
                onChange={(e) =>
                  handleDataChange("variableToSave", e.target.value)
                }
              />
              <p className="text-xs text-zoru-ink-muted">
                Use {"{{user_name}}"} in later steps.
              </p>
            </div>
          </div>
        );
      case "delay":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="delay-seconds">Delay (seconds)</Label>
              <Input
                id="delay-seconds"
                type="number"
                min="1"
                value={selectedNode.data.delaySeconds || 1}
                onChange={(e) =>
                  handleDataChange(
                    "delaySeconds",
                    parseFloat(e.target.value),
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-[var(--zoru-radius-lg)] border border-zoru-line p-3">
              <Label htmlFor="typing-indicator" className="font-normal">
                Show typing indicator
              </Label>
              <Switch
                id="typing-indicator"
                checked={selectedNode.data.showTyping}
                onCheckedChange={(checked: boolean) =>
                  handleDataChange("showTyping", checked)
                }
              />
            </div>
          </div>
        );
      case "condition":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Condition type</Label>
              <RadioGroup
                value={selectedNode.data.conditionType || "variable"}
                onValueChange={(val: string) =>
                  handleDataChange("conditionType", val)
                }
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center gap-2">
                  <ZoruRadioGroupItem value="variable" id="type-variable" />
                  <Label
                    htmlFor="type-variable"
                    className="font-normal"
                  >
                    Variable
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <ZoruRadioGroupItem
                    value="user_response"
                    id="type-user-response"
                  />
                  <Label
                    htmlFor="type-user-response"
                    className="font-normal"
                  >
                    User response
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-zoru-ink-muted">
                &ldquo;User response&rdquo; will pause the flow and wait for
                the user&rsquo;s next message.
              </p>
            </div>

            {(selectedNode.data.conditionType === "variable" ||
              !selectedNode.data.conditionType) && (
              <div className="space-y-1.5">
                <Label htmlFor="condition-variable">
                  Variable to check
                </Label>
                <Input
                  id="condition-variable"
                  placeholder="e.g., {{user_name}}"
                  value={selectedNode.data.variable || ""}
                  onChange={(e) =>
                    handleDataChange("variable", e.target.value)
                  }
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="condition-operator">Operator</Label>
              <Select
                value={selectedNode.data.operator || "equals"}
                onValueChange={(val: string) =>
                  handleDataChange("operator", val)
                }
              >
                <ZoruSelectTrigger id="condition-operator">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="equals">Equals</ZoruSelectItem>
                  <ZoruSelectItem value="not_equals">
                    Does not equal
                  </ZoruSelectItem>
                  <ZoruSelectItem value="contains">Contains</ZoruSelectItem>
                  <ZoruSelectItem value="is_one_of">
                    Is one of (comma-sep)
                  </ZoruSelectItem>
                  <ZoruSelectItem value="is_not_one_of">
                    Is not one of (comma-sep)
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="condition-value">
                Value to compare against
              </Label>
              <Input
                id="condition-value"
                placeholder="e.g., confirmed"
                value={selectedNode.data.value || ""}
                onChange={(e) => handleDataChange("value", e.target.value)}
              />
            </div>
          </div>
        );
      case "api":
        return (
          <div className="space-y-4">
            <Select
              value={selectedNode.data.apiRequest?.method || "GET"}
              onValueChange={(val: string) => handleApiChange("method", val)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="GET">GET</ZoruSelectItem>
                <ZoruSelectItem value="POST">POST</ZoruSelectItem>
                <ZoruSelectItem value="PUT">PUT</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Input
              placeholder="https://api.example.com"
              value={selectedNode.data.apiRequest?.url || ""}
              onChange={(e) => handleApiChange("url", e.target.value)}
            />
            <Textarea
              placeholder='Headers (JSON)\n{ "Authorization": "Bearer …" }'
              className="h-24 font-mono text-xs"
              value={selectedNode.data.apiRequest?.headers || ""}
              onChange={(e) => handleApiChange("headers", e.target.value)}
            />
            <Textarea
              placeholder="Request body (JSON)"
              className="h-32 font-mono text-xs"
              value={selectedNode.data.apiRequest?.body || ""}
              onChange={(e) => handleApiChange("body", e.target.value)}
            />
            <Separator />
            <Label>Save response to variables</Label>
            <div className="space-y-3">
              {(selectedNode.data.apiRequest?.responseMappings || []).map(
                (
                  mapping: { variable?: string; path?: string },
                  index: number,
                ) => (
                  <div
                    key={index}
                    className="relative space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line p-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1"
                      onClick={() => removeMapping(index)}
                      aria-label="Remove mapping"
                    >
                      <Trash2 />
                    </Button>
                    <Input
                      placeholder="Variable name (e.g. user_email)"
                      value={mapping.variable || ""}
                      onChange={(e) =>
                        handleMappingChange(index, "variable", e.target.value)
                      }
                    />
                    <Input
                      placeholder="Response path (e.g. data.email)"
                      value={mapping.path || ""}
                      onChange={(e) =>
                        handleMappingChange(index, "path", e.target.value)
                      }
                    />
                  </div>
                ),
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              block
              onClick={addMapping}
            >
              <Plus />
              Add mapping
            </Button>
            <p className="text-xs text-zoru-ink-muted">
              Use {"{{variable_name}}"} to access mapped values later.
            </p>
          </div>
        );
      case "carousel": {
        const elements: CarouselElement[] = selectedNode.data.elements || [];
        return (
          <div className="space-y-4">
            <Label>Carousel cards ({elements.length}/10)</Label>
            <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-2">
              {elements.map((el, elIndex) => (
                <div
                  key={el.id}
                  className="relative space-y-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface-2 p-3"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1"
                    onClick={() => removeElement(el.id)}
                    aria-label="Remove card"
                  >
                    <Trash2 />
                  </Button>
                  <h4 className="text-sm tracking-tight text-zoru-ink">
                    Card {elIndex + 1}
                  </h4>
                  <ZoruFileInput
                    accept="image"
                    placeholder="Pick a card image"
                    pickerTitle="Pick card image"
                    value={
                      el.image_url
                        ? { id: el.image_url, name: el.image_url, mimeType: "", size: 0, tag: "image", url: el.image_url, key: el.image_url, createdAt: "" }
                        : null
                    }
                    onChange={(file) => handleElementChange(el.id, "image_url", file?.url ?? "")}
                  />
                  <Input
                    placeholder="Title (80 chars max)"
                    value={el.title}
                    onChange={(e) =>
                      handleElementChange(el.id, "title", e.target.value)
                    }
                    maxLength={80}
                    required
                  />
                  <Input
                    placeholder="Subtitle (80 chars max)"
                    value={el.subtitle || ""}
                    onChange={(e) =>
                      handleElementChange(el.id, "subtitle", e.target.value)
                    }
                    maxLength={80}
                  />
                  <div className="space-y-2">
                    {(el.buttons || []).map((btn, btnIndex) => (
                      <div
                        key={btnIndex}
                        className="relative space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2"
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-1 top-1"
                          onClick={() =>
                            removeElementButton(el.id, btnIndex)
                          }
                          aria-label="Remove card button"
                        >
                          <Trash2 />
                        </Button>
                        <RadioGroup
                          value={btn.type}
                          onValueChange={(val: string) =>
                            handleElementButtonChange(
                              el.id,
                              btnIndex,
                              "type",
                              val,
                            )
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <ZoruRadioGroupItem
                              value="web_url"
                              id={`btn-type-url-${el.id}-${btnIndex}`}
                            />
                            <Label
                              htmlFor={`btn-type-url-${el.id}-${btnIndex}`}
                              className="font-normal"
                            >
                              URL
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <ZoruRadioGroupItem
                              value="postback"
                              id={`btn-type-postback-${el.id}-${btnIndex}`}
                            />
                            <Label
                              htmlFor={`btn-type-postback-${el.id}-${btnIndex}`}
                              className="font-normal"
                            >
                              Postback
                            </Label>
                          </div>
                        </RadioGroup>
                        <Input
                          placeholder="Button title (20 chars max)"
                          value={btn.title}
                          onChange={(e) =>
                            handleElementButtonChange(
                              el.id,
                              btnIndex,
                              "title",
                              e.target.value,
                            )
                          }
                          maxLength={20}
                          required
                        />
                        {btn.type === "web_url" ? (
                          <>
                            <Input
                              placeholder="https://example.com/cart?user_id={{psid}}"
                              value={btn.url || ""}
                              onChange={(e) =>
                                handleElementButtonChange(
                                  el.id,
                                  btnIndex,
                                  "url",
                                  e.target.value,
                                )
                              }
                              required
                            />
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <div className="space-y-1">
                                <Label
                                  htmlFor={`webview-height-${el.id}-${btnIndex}`}
                                  className="text-xs"
                                >
                                  Webview height
                                </Label>
                                <Select
                                  value={btn.webview_height_ratio || "full"}
                                  onValueChange={(val: string) =>
                                    handleElementButtonChange(
                                      el.id,
                                      btnIndex,
                                      "webview_height_ratio",
                                      val,
                                    )
                                  }
                                >
                                  <ZoruSelectTrigger
                                    id={`webview-height-${el.id}-${btnIndex}`}
                                    className="h-8"
                                  >
                                    <ZoruSelectValue />
                                  </ZoruSelectTrigger>
                                  <ZoruSelectContent>
                                    <ZoruSelectItem value="full">
                                      Full
                                    </ZoruSelectItem>
                                    <ZoruSelectItem value="tall">
                                      Tall
                                    </ZoruSelectItem>
                                    <ZoruSelectItem value="compact">
                                      Compact
                                    </ZoruSelectItem>
                                  </ZoruSelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1 pt-1">
                                <Label
                                  htmlFor={`messenger-ext-${el.id}-${btnIndex}`}
                                  className="text-xs"
                                >
                                  Extensions
                                </Label>
                                <Switch
                                  id={`messenger-ext-${el.id}-${btnIndex}`}
                                  checked={btn.messenger_extensions || false}
                                  onCheckedChange={(checked: boolean) =>
                                    handleElementButtonChange(
                                      el.id,
                                      btnIndex,
                                      "messenger_extensions",
                                      checked,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <Input
                            placeholder="Payload_for_webhook"
                            value={btn.payload || ""}
                            onChange={(e) =>
                              handleElementButtonChange(
                                el.id,
                                btnIndex,
                                "payload",
                                e.target.value,
                              )
                            }
                            required
                          />
                        )}
                      </div>
                    ))}
                    {(el.buttons?.length || 0) < 3 ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addElementButton(el.id, "web_url")}
                        >
                          + URL button
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addElementButton(el.id, "postback")}
                        >
                          + Postback button
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              block
              onClick={addElement}
            >
              <Plus />
              Add card
            </Button>
          </div>
        );
      }
      case "addToCart":
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="productId">Product ID / SKU</Label>
              <Input
                id="productId"
                value={selectedNode.data.productId || ""}
                onChange={(e) =>
                  handleDataChange("productId", e.target.value)
                }
                placeholder="e.g., TSHIRT-001 or {{selected_sku}}"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="productName">Product name</Label>
              <Input
                id="productName"
                value={selectedNode.data.productName || ""}
                onChange={(e) =>
                  handleDataChange("productName", e.target.value)
                }
                placeholder="e.g., Cool T-Shirt or {{product_name}}"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={selectedNode.data.quantity || 1}
                  onChange={(e) =>
                    handleDataChange(
                      "quantity",
                      parseInt(e.target.value, 10) || 1,
                    )
                  }
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  value={selectedNode.data.price || ""}
                  onChange={(e) =>
                    handleDataChange(
                      "price",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="e.g., 25.00 or {{product_price}}"
                />
              </div>
            </div>
          </div>
        );
      default:
        return (
          <p className="text-sm italic text-zoru-ink-muted">
            No properties to configure for this block type.
          </p>
        );
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <ZoruCardHeader>
        <ZoruCardTitle>Properties</ZoruCardTitle>
        <ZoruCardDescription>
          Configure the &lsquo;{selectedNode.data.label}&rsquo; block.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ScrollArea className="flex-1">
        <ZoruCardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="node-label">Block label</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label || ""}
              onChange={(e) => handleDataChange("label", e.target.value)}
            />
          </div>
          <Separator />
          {renderProperties()}
        </ZoruCardContent>
      </ScrollArea>
      {selectedNode.type !== "start" ? (
        <ZoruCardFooter className="border-t border-zoru-line pt-4">
          <Button
            variant="destructive"
            block
            onClick={() => deleteNode(selectedNode.id)}
          >
            <Trash2 />
            Delete block
          </Button>
        </ZoruCardFooter>
      ) : null}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Flows + Blocks panel
// ──────────────────────────────────────────────────────────────────────
function FlowsAndBlocksPanel({
  isLoading,
  flows,
  currentFlow,
  handleSelectFlow,
  handleDeleteFlow,
  handleCreateNewFlow,
  addNode,
}: {
  isLoading: boolean;
  flows: WithId<EcommFlow>[];
  currentFlow: WithId<EcommFlow> | null;
  handleSelectFlow: (id: string) => void;
  handleDeleteFlow: (id: string) => void;
  handleCreateNewFlow: () => void;
  addNode: (type: NodeType) => void;
}) {
  return (
    <>
      <Card>
        <ZoruCardHeader className="flex-row items-center justify-between p-3">
          <ZoruCardTitle className="text-base">Flows</ZoruCardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCreateNewFlow}
            aria-label="New flow"
          >
            <Plus />
          </Button>
        </ZoruCardHeader>
        <ZoruCardContent className="p-2 pt-0">
          <ScrollArea className="h-40">
            {isLoading && flows.length === 0 ? (
              <Skeleton className="h-full w-full" />
            ) : (
              flows.map((flow) => {
                const isActive =
                  currentFlow?._id.toString() === flow._id.toString();
                return (
                  <div
                    key={flow._id.toString()}
                    className="group flex items-center"
                  >
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      block
                      className="justify-start font-normal"
                      onClick={() => handleSelectFlow(flow._id.toString())}
                    >
                      <FileIcon />
                      {flow.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteFlow(flow._id.toString())}
                      aria-label="Delete flow"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </ZoruCardContent>
      </Card>
      <Card className="flex flex-1 flex-col">
        <ZoruCardHeader className="p-3">
          <ZoruCardTitle className="text-base">Blocks</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="min-h-0 flex-1 space-y-2 p-2 pt-0">
          <ScrollArea className="h-full">
            {blockTypes.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                variant="outline"
                block
                className="mb-2 justify-start"
                onClick={() => addNode(type as NodeType)}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </ScrollArea>
        </ZoruCardContent>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Canvas geometry helpers (preserved from legacy)
// ──────────────────────────────────────────────────────────────────────
const NODE_WIDTH = 256;

const getEdgePath = (
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
) => {
  if (!sourcePos || !targetPos) return "";
  const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
  return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
};

const getNodeHandlePosition = (node: EcommFlowNode, handleId: string) => {
  if (!node || !handleId) return null;
  const x = node.position.x;
  const y = node.position.y;
  let nodeHeight = 60;
  if (node.type === "condition") nodeHeight = 80;
  if (node.type === "buttons") {
    const buttonCount = (node.data.buttons || []).length;
    nodeHeight = 60 + buttonCount * 20;
  }

  if (handleId.endsWith("-input")) return { x, y: y + 30 };
  if (handleId.endsWith("-output-main")) return { x: x + NODE_WIDTH, y: y + 30 };
  if (handleId.endsWith("-output-yes"))
    return { x: x + NODE_WIDTH, y: y + nodeHeight * (1 / 3) };
  if (handleId.endsWith("-output-no"))
    return { x: x + NODE_WIDTH, y: y + nodeHeight * (2 / 3) };
  if (handleId.includes("-btn-")) {
    const buttonIndex = parseInt(handleId.split("-btn-")[1], 10);
    const totalButtons = (node.data.buttons || []).length;
    const topPosition =
      totalButtons > 1
        ? 60 + ((nodeHeight - 60) / (totalButtons + 1)) * (buttonIndex + 1)
        : 60 + (nodeHeight - 60) / 2;
    return { x: x + NODE_WIDTH, y: y + topPosition };
  }
  if (handleId.includes("output")) return { x: x + NODE_WIDTH, y: y + 30 };
  return null;
};

// ──────────────────────────────────────────────────────────────────────
// Top-level page
// ──────────────────────────────────────────────────────────────────────
export default function EcommFlowBuilderPage() {
  const { toast } = useZoruToast();
  const [isClient, setIsClient] = useState(false);
  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [flows, setFlows] = useState<WithId<EcommFlow>[]>([]);
  const [currentFlow, setCurrentFlow] = useState<WithId<EcommFlow> | null>(
    null,
  );
  const [nodes, setNodes] = useState<EcommFlowNode[]>([]);
  const [edges, setEdges] = useState<EcommFlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isLoading, startLoadingTransition] = useTransition();

  const [isBlocksSheetOpen, setIsBlocksSheetOpen] = useState(false);
  const [isPropsSheetOpen, setIsPropsSheetOpen] = useState(false);

  // Canvas state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    sourceNodeId: string;
    sourceHandleId: string;
    startPos: { x: number; y: number };
  } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const params = useParams();
  const shopId = params?.shopId as string | undefined;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSelectFlow = useCallback(async (flowId: string) => {
    const flow = await getEcommFlowById(flowId);
    setCurrentFlow(flow);
    setNodes(flow?.nodes || []);
    setEdges(flow?.edges || []);
    setSelectedNodeId(null);
    setIsBlocksSheetOpen(false);
  }, []);

  const handleCreateNewFlow = useCallback(() => {
    setCurrentFlow(null);
    setNodes([
      {
        id: "start",
        type: "start",
        data: { label: "Start flow" },
        position: { x: 50, y: 150 },
      },
    ]);
    setEdges([]);
    setSelectedNodeId("start");
  }, []);

  const fetchFlows = useCallback(
    (projectId: string) => {
      if (!projectId) return;
      startLoadingTransition(async () => {
        const flowsData = await getEcommFlows(projectId);
        setFlows(flowsData);
        if (flowsData.length > 0 && !currentFlow) {
          handleSelectFlow(flowsData[0]._id.toString());
        } else if (flowsData.length === 0) {
          handleCreateNewFlow();
        }
      });
    },
    [currentFlow, handleSelectFlow, handleCreateNewFlow],
  );

  useEffect(() => {
    if (isClient && shopId) {
      startLoadingTransition(async () => {
        const shopData = await getEcommShopById(shopId);
        setShop(shopData);
        if (shopData) {
          fetchFlows(shopData.projectId.toString());
        }
      });
    }
  }, [isClient, shopId, fetchFlows]);

  const addNode = (type: NodeType) => {
    const centerOfViewX = viewportRef.current
      ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom
      : 300;
    const centerOfViewY = viewportRef.current
      ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom
      : 150;

    const newNode: EcommFlowNode = {
      id: `${type}-${Date.now()}`,
      type,
      data: {
        label: `New ${type}`,
        apiRequest: {
          method: "GET",
          url: "",
          headers: "",
          body: "",
          responseMappings: [],
        },
      },
      position: { x: centerOfViewX, y: centerOfViewY },
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setIsBlocksSheetOpen(false);
  };

  const updateNodeData = (
    id: string,
    data: Partial<Record<string, unknown>>,
  ) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    );
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((node) => node.id !== id));
    setEdges((prev) =>
      prev.filter((edge) => edge.source !== id && edge.target !== id),
    );
    if (selectedNodeId === id) setSelectedNodeId(null);
    setIsPropsSheetOpen(false);
  };

  const handleSaveFlow = () => {
    if (!shop) return;
    const flowName = (
      document.getElementById("flow-name-input") as HTMLInputElement | null
    )?.value;
    if (!flowName) return;
    const startNode = nodes.find((n) => n.type === "start");
    const triggerKeywords =
      startNode?.data.triggerKeywords
        ?.split(",")
        .map((k: string) => k.trim())
        .filter(Boolean) || [];
    const isWelcomeFlow = startNode?.data.isWelcomeFlow || false;

    startSaveTransition(async () => {
      const result = await saveEcommFlow({
        flowId: currentFlow?._id.toString(),
        projectId: shop.projectId.toString(),
        name: flowName,
        nodes,
        edges,
        triggerKeywords,
        isWelcomeFlow,
      });
      if (result.error) {
        toast({
          title: "Could not save flow",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Flow saved",
          description: result.message,
        });
        if (result.flowId) {
          await handleSelectFlow(result.flowId);
        }
        fetchFlows(shop.projectId.toString());
      }
    });
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!shop) return;
    const result = await deleteEcommFlow(flowId);
    if (result.error) {
      toast({
        title: "Could not delete",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({ title: "Flow deleted", description: result.message });
      fetchFlows(shop.projectId.toString());
      if (currentFlow?._id.toString() === flowId) {
        handleCreateNewFlow();
      }
    }
  };

  // Canvas event handlers (preserved verbatim)
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingNode(nodeId);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setIsPanning(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    } else if (draggingNode) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode
            ? {
                ...n,
                position: {
                  x: n.position.x + e.movementX / zoom,
                  y: n.position.y + e.movementY / zoom,
                },
              }
            : n,
        ),
      );
    }

    if (connecting && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setMousePosition({
        x: (mouseX - pan.x) / zoom,
        y: (mouseY - pan.y) / zoom,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (connecting) {
        setConnecting(null);
      } else {
        setSelectedNodeId(null);
      }
    }
  };

  const handleHandleClick = (
    e: React.MouseEvent,
    nodeId: string,
    handleId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!viewportRef.current) return;

    const isOutputHandle =
      handleId.includes("output") || handleId.includes("-btn-");

    if (isOutputHandle) {
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (sourceNode) {
        const handlePos = getNodeHandlePosition(sourceNode, handleId);
        if (handlePos) {
          setConnecting({
            sourceNodeId: nodeId,
            sourceHandleId: handleId,
            startPos: handlePos,
          });
        }
      }
    } else if (connecting && !isOutputHandle) {
      if (connecting.sourceNodeId === nodeId) {
        setConnecting(null);
        return;
      }
      const newEdge = {
        id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`,
        source: connecting.sourceNodeId,
        target: nodeId,
        sourceHandle: connecting.sourceHandleId,
        targetHandle: handleId,
      } as unknown as EcommFlowEdge;

      const edgesWithoutExistingTarget = edges.filter(
        (edge) =>
          !(
            edge.target === nodeId &&
            (edge as unknown as { targetHandle?: string }).targetHandle ===
              handleId
          ),
      );
      const sourceHasSingleOutput =
        !connecting.sourceHandleId.includes("btn-") &&
        !connecting.sourceHandleId.includes("output-yes") &&
        !connecting.sourceHandleId.includes("output-no");
      if (sourceHasSingleOutput) {
        const edgesWithoutExistingSource = edgesWithoutExistingTarget.filter(
          (e) => e.source !== connecting.sourceNodeId,
        );
        setEdges([...edgesWithoutExistingSource, newEdge]);
      } else {
        setEdges([...edgesWithoutExistingTarget, newEdge]);
      }
      setConnecting(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = -0.001;
    const newZoom = Math.max(
      0.2,
      Math.min(2, zoom + e.deltaY * zoomFactor),
    );
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  useEffect(() => {
    if (selectedNodeId) setIsPropsSheetOpen(true);
  }, [selectedNodeId]);

  const handleZoomControls = (direction: "in" | "out" | "reset") => {
    if (direction === "reset") {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setZoom((prevZoom) => {
      const newZoom = direction === "in" ? prevZoom * 1.2 : prevZoom / 1.2;
      return Math.max(0.2, Math.min(2, newZoom));
    });
  };

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      viewportRef.current
        ?.requestFullscreen()
        ?.catch((err: Error) => {
          alert(`Error attempting full-screen: ${err.message}`);
        });
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!isClient) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!shopId || !shop) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>No shop found</ZoruAlertTitle>
        <ZoruAlertDescription>
          Please select a valid shop to use the chat-bot builder.
        </ZoruAlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* ── Save bar / chrome ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-zoru-ink-muted" />
          <Input
            id="flow-name-input"
            key={currentFlow?._id.toString() || "new-flow"}
            defaultValue={currentFlow?.name || "New flow"}
            className="h-auto border-0 p-0 text-2xl tracking-tight shadow-none focus-visible:ring-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="outline"
              onClick={() => setIsBlocksSheetOpen(true)}
            >
              <PanelLeft />
              Flows &amp; blocks
            </Button>
            {selectedNode ? (
              <Button
                variant="outline"
                onClick={() => setIsPropsSheetOpen(true)}
              >
                <Settings2 />
                Properties
              </Button>
            ) : null}
          </div>
          <Button variant="outline" asChild>
            <Link
              href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}/flow-builder/docs`}
            >
              <BookOpen />
              <span className="hidden sm:inline">View docs</span>
            </Link>
          </Button>
          <Button onClick={handleSaveFlow} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
            <span className="hidden sm:inline">Save flow</span>
          </Button>
        </div>
      </div>

      {/* ── Workspace grid ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-12">
        <div className="hidden flex-col gap-4 md:col-span-3 md:flex lg:col-span-2">
          <FlowsAndBlocksPanel
            isLoading={isLoading}
            flows={flows}
            currentFlow={currentFlow}
            handleSelectFlow={handleSelectFlow}
            handleDeleteFlow={handleDeleteFlow}
            handleCreateNewFlow={handleCreateNewFlow}
            addNode={addNode}
          />
        </div>

        <Sheet
          open={isBlocksSheetOpen}
          onOpenChange={setIsBlocksSheetOpen}
        >
          <ZoruSheetContent
            side="left"
            className="flex w-full max-w-xs flex-col gap-4 p-2"
          >
            <ZoruSheetTitle className="sr-only">
              Flows and blocks
            </ZoruSheetTitle>
            <ZoruSheetDescription className="sr-only">
              A list of flows and draggable blocks.
            </ZoruSheetDescription>
            <FlowsAndBlocksPanel
              isLoading={isLoading}
              flows={flows}
              currentFlow={currentFlow}
              handleSelectFlow={handleSelectFlow}
              handleDeleteFlow={handleDeleteFlow}
              handleCreateNewFlow={handleCreateNewFlow}
              addNode={addNode}
            />
          </ZoruSheetContent>
        </Sheet>

        <div className="md:col-span-6 lg:col-span-7">
          <Card
            ref={viewportRef}
            className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0)",
                backgroundSize: "20px 20px",
                backgroundPosition: `${pan.x}px ${pan.y}px`,
              }}
            />
            <div
              className="relative h-full w-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              {isLoading && !currentFlow ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
                </div>
              ) : (
                <>
                  {nodes.map((node) => (
                    <NodeComponent
                      key={node.id}
                      node={node}
                      onSelectNode={setSelectedNodeId}
                      isSelected={selectedNodeId === node.id}
                      onNodeMouseDown={handleNodeMouseDown}
                      onHandleClick={handleHandleClick}
                    />
                  ))}
                  <svg
                    className="pointer-events-none absolute left-0 top-0"
                    style={{
                      width: "5000px",
                      height: "5000px",
                      transformOrigin: "top left",
                    }}
                  >
                    {edges.map((edge) => {
                      const sourceNode = nodes.find(
                        (n) => n.id === edge.source,
                      );
                      const targetNode = nodes.find(
                        (n) => n.id === edge.target,
                      );
                      if (!sourceNode || !targetNode) return null;
                      const sourcePos = getNodeHandlePosition(
                        sourceNode,
                        edge.sourceHandle || `${edge.source}-output-main`,
                      );
                      const targetPos = getNodeHandlePosition(
                        targetNode,
                        (edge as unknown as { targetHandle?: string })
                          .targetHandle || `${edge.target}-input`,
                      );
                      if (!sourcePos || !targetPos) return null;
                      return (
                        <path
                          key={edge.id}
                          d={getEdgePath(sourcePos, targetPos)}
                          stroke="rgba(0,0,0,0.4)"
                          strokeWidth={2}
                          fill="none"
                        />
                      );
                    })}
                    {connecting ? (
                      <path
                        d={getEdgePath(connecting.startPos, mousePosition)}
                        stroke="black"
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray="5,5"
                      />
                    ) : null}
                  </svg>
                </>
              )}
            </div>
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoomControls("out")}
                aria-label="Zoom out"
              >
                <ZoomOut />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoomControls("in")}
                aria-label="Zoom in"
              >
                <ZoomIn />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleZoomControls("reset")}
                aria-label="Reset zoom"
              >
                <Frame />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleFullScreen}
                aria-label="Toggle full screen"
              >
                {isFullScreen ? <Minimize /> : <Maximize />}
              </Button>
            </div>
          </Card>
        </div>

        <div className="hidden md:col-span-3 md:block">
          {selectedNode ? (
            <PropertiesPanel
              selectedNode={selectedNode}
              updateNodeData={updateNodeData}
              deleteNode={deleteNode}
            />
          ) : null}
        </div>

        <Sheet
          open={isPropsSheetOpen}
          onOpenChange={setIsPropsSheetOpen}
        >
          <ZoruSheetContent
            side="right"
            className="flex w-full max-w-md flex-col p-0"
          >
            <ZoruSheetTitle className="sr-only">
              Block properties
            </ZoruSheetTitle>
            <ZoruSheetDescription className="sr-only">
              Configure the selected block&rsquo;s properties.
            </ZoruSheetDescription>
            {selectedNode ? (
              <PropertiesPanel
                selectedNode={selectedNode}
                updateNodeData={updateNodeData}
                deleteNode={deleteNode}
              />
            ) : null}
          </ZoruSheetContent>
        </Sheet>
      </div>
    </div>
  );
}
