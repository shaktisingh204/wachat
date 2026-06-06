"use client";

/**
 * Single node renderer for the drip canvas.
 *
 * Each node sits on a vertical rail (top → bottom). The builder keeps
 * the layout intentionally simple — no heavyweight graph library — so
 * we can fit on Vercel / self-hosted with the same React-only DOM.
 *
 * Branch nodes draw two outgoing labelled paths ("yes" / "no") that
 * the parent canvas wires up with absolute-positioned SVG paths.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  GitBranch,
  Mail,
  PauseCircle,
  PlayCircle,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
} from "@/components/sabcrm/20ui/zoru";

import type { DraftDripNode } from "./validate";

interface TemplateOption {
  id: string;
  name: string;
  category: string;
}

export interface StepNodeProps {
  node: DraftDripNode;
  templates: TemplateOption[];
  errors: string[];
  dripId: string;
  onChange: (next: DraftDripNode) => void;
  onDelete: () => void;
  onSuggest?: () => void;
}

const KIND_LABEL: Record<DraftDripNode["kind"], string> = {
  start: "Start",
  message: "Send message",
  wait: "Wait",
  branch: "Branch",
  exit: "Exit",
};

const KIND_ICON: Record<DraftDripNode["kind"], React.ComponentType<{ className?: string }>> = {
  start: PlayCircle,
  message: Mail,
  wait: Clock,
  branch: GitBranch,
  exit: PauseCircle,
};

export function StepNode({
  node,
  templates,
  errors,
  dripId,
  onChange,
  onDelete,
  onSuggest,
}: StepNodeProps) {
  const Icon = KIND_ICON[node.kind];
  const hasError = errors.length > 0;
  const isTerminal = node.kind === "start" || node.kind === "exit";

  return (
    <Card
      className={
        hasError
          ? "border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 transition"
          : "border-[var(--st-border)] transition hover:border-[var(--st-border)]"
      }
    >
      <div className="flex items-center justify-between border-b border-[var(--st-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={
              hasError
                ? "rounded-md bg-[var(--st-bg-muted)] p-1.5 text-[var(--st-text)]"
                : "rounded-md bg-[var(--st-bg-muted)] p-1.5 text-[var(--st-text)]"
            }
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-[var(--st-text)]">
            {KIND_LABEL[node.kind]}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {node.id}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {onSuggest && !isTerminal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSuggest}
              aria-label="Suggest next step"
              title="Suggest next step"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Analytics">
            <Link href={`/sabsms/analytics?dripId=${dripId}&stepId=${node.id}`}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {!isTerminal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--st-text)] hover:text-[var(--st-text)]"
              onClick={onDelete}
              aria-label="Delete step"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <ZoruCardContent className="space-y-3 p-4">
        {node.kind === "message" && (
          <div className="space-y-2">
            <Label htmlFor={`tpl-${node.id}`} className="text-xs font-medium text-[var(--st-text)]">
              Template
            </Label>
            <Select
              value={node.templateId ?? ""}
              onValueChange={(v) => onChange({ ...node, templateId: v })}
            >
              <ZoruSelectTrigger id={`tpl-${node.id}`}>
                <ZoruSelectValue placeholder="Pick template…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {templates.map((t) => (
                  <ZoruSelectItem key={t.id} value={t.id}>
                    {t.name}{" "}
                    <span className="ml-1 text-[10px] text-[var(--st-text)]">({t.category})</span>
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
        )}

        {node.kind === "wait" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {/* Segmented buttons — no tab UI primitive. */}
              <Button
                size="sm"
                variant={node.waitMode !== "absolute" ? "default" : "outline"}
                onClick={() => onChange({ ...node, waitMode: "relative" })}
              >
                Relative
              </Button>
              <Button
                size="sm"
                variant={node.waitMode === "absolute" ? "default" : "outline"}
                onClick={() => onChange({ ...node, waitMode: "absolute" })}
              >
                Absolute
              </Button>
            </div>
            {node.waitMode === "absolute" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Wait until</Label>
                <Input
                  type="datetime-local"
                  value={node.waitAbsoluteAt ?? ""}
                  onChange={(e) => onChange({ ...node, waitAbsoluteAt: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Wait (seconds)</Label>
                <Input
                  type="number"
                  min={0}
                  value={node.waitSeconds ?? 0}
                  onChange={(e) =>
                    onChange({ ...node, waitSeconds: Number.parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-[11px] text-[var(--st-text)]">
                  e.g. 86400 = 24h, 604800 = 7 days.
                </p>
              </div>
            )}
          </div>
        )}

        {node.kind === "branch" && (
          <div className="space-y-2">
            <Label className="text-xs">Branch on</Label>
            <Select
              value={node.branchOn ?? "replied"}
              onValueChange={(v) =>
                onChange({ ...node, branchOn: v as DraftDripNode["branchOn"] })
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="replied">Replied</ZoruSelectItem>
                <ZoruSelectItem value="clicked">Clicked a link</ZoruSelectItem>
                <ZoruSelectItem value="opened">Opened (carrier read receipt)</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Label className="text-xs">Within (seconds)</Label>
            <Input
              type="number"
              min={0}
              value={node.branchWithinSeconds ?? 86400}
              onChange={(e) =>
                onChange({
                  ...node,
                  branchWithinSeconds: Number.parseInt(e.target.value, 10) || 0,
                })
              }
            />
            <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--st-text)]">
              <ArrowRight className="h-3 w-3" />
              True → first outgoing edge · False → second.
            </div>
          </div>
        )}

        {!isTerminal && (
          <>
            <Separator />
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--st-text)] hover:text-[var(--st-text)]">
                <Settings2 className="h-3 w-3" /> Advanced
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Quiet hours start</Label>
                    <Input
                      type="time"
                      value={node.quietHours?.start ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          quietHours: {
                            ...(node.quietHours ?? { start: "", end: "" }),
                            start: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Quiet hours end</Label>
                    <Input
                      type="time"
                      value={node.quietHours?.end ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          quietHours: {
                            ...(node.quietHours ?? { start: "", end: "" }),
                            end: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Send window start</Label>
                    <Input
                      type="time"
                      value={node.timeWindow?.start ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          timeWindow: {
                            ...(node.timeWindow ?? { start: "", end: "" }),
                            start: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Send window end</Label>
                    <Input
                      type="time"
                      value={node.timeWindow?.end ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          timeWindow: {
                            ...(node.timeWindow ?? { start: "", end: "" }),
                            end: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center justify-between text-xs">
                  <span className="text-[var(--st-text)]">Skip on weekends</span>
                  <Switch
                    checked={!!node.skipOnWeekend}
                    onCheckedChange={(v) => onChange({ ...node, skipOnWeekend: !!v })}
                  />
                </label>
                <div>
                  <Label className="text-[11px]">
                    <Zap className="mr-1 inline h-3 w-3" /> Throttle (msgs/sec)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={node.throttlePerSecond ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...node,
                        throttlePerSecond:
                          e.target.value === ""
                            ? undefined
                            : Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">
                    <Bell className="mr-1 inline h-3 w-3" /> Provider override
                  </Label>
                  <Input
                    value={node.providerOverride ?? ""}
                    onChange={(e) => onChange({ ...node, providerOverride: e.target.value || undefined })}
                    placeholder="twilio / msg91 / vonage…"
                  />
                </div>
                {node.kind === "message" && (
                  <div className="space-y-1.5 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2">
                    <div className="text-[11px] font-medium text-[var(--st-text)]">A/B split</div>
                    <Input
                      placeholder="Variant B templateId"
                      value={node.abSplit?.variantBTemplateId ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          abSplit: {
                            variantBTemplateId: e.target.value,
                            bPercent: node.abSplit?.bPercent ?? 50,
                          },
                        })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="% to B"
                      value={node.abSplit?.bPercent ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...node,
                          abSplit: {
                            variantBTemplateId: node.abSplit?.variantBTemplateId ?? "",
                            bPercent: Number.parseInt(e.target.value, 10) || 0,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </details>
          </>
        )}

        {hasError && (
          <div className="flex items-start gap-1.5 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1.5 text-[11px] text-[var(--st-text)]">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <div className="space-y-0.5">
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          </div>
        )}
      </ZoruCardContent>
    </Card>
  );
}
