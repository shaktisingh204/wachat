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
} from "@/components/zoruui";

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
    <ZoruCard
      className={
        hasError
          ? "border-rose-300 bg-rose-50/50 transition"
          : "border-slate-200 transition hover:border-slate-300"
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={
              hasError
                ? "rounded-md bg-rose-100 p-1.5 text-rose-700"
                : "rounded-md bg-slate-100 p-1.5 text-slate-700"
            }
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-slate-800">
            {KIND_LABEL[node.kind]}
          </span>
          <ZoruBadge variant="secondary" className="text-[10px]">
            {node.id}
          </ZoruBadge>
        </div>
        <div className="flex items-center gap-1">
          {onSuggest && !isTerminal && (
            <ZoruButton
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSuggest}
              aria-label="Suggest next step"
              title="Suggest next step"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </ZoruButton>
          )}
          <ZoruButton asChild variant="ghost" size="icon" className="h-7 w-7" title="Analytics">
            <Link href={`/sabsms/analytics?dripId=${dripId}&stepId=${node.id}`}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
          </ZoruButton>
          {!isTerminal && (
            <ZoruButton
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-rose-600 hover:text-rose-700"
              onClick={onDelete}
              aria-label="Delete step"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ZoruButton>
          )}
        </div>
      </div>

      <ZoruCardContent className="space-y-3 p-4">
        {node.kind === "message" && (
          <div className="space-y-2">
            <ZoruLabel htmlFor={`tpl-${node.id}`} className="text-xs font-medium text-slate-700">
              Template
            </ZoruLabel>
            <ZoruSelect
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
                    <span className="ml-1 text-[10px] text-slate-500">({t.category})</span>
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        )}

        {node.kind === "wait" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {/* Segmented buttons — no tab UI primitive. */}
              <ZoruButton
                size="sm"
                variant={node.waitMode !== "absolute" ? "default" : "outline"}
                onClick={() => onChange({ ...node, waitMode: "relative" })}
              >
                Relative
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant={node.waitMode === "absolute" ? "default" : "outline"}
                onClick={() => onChange({ ...node, waitMode: "absolute" })}
              >
                Absolute
              </ZoruButton>
            </div>
            {node.waitMode === "absolute" ? (
              <div className="space-y-1.5">
                <ZoruLabel className="text-xs">Wait until</ZoruLabel>
                <ZoruInput
                  type="datetime-local"
                  value={node.waitAbsoluteAt ?? ""}
                  onChange={(e) => onChange({ ...node, waitAbsoluteAt: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <ZoruLabel className="text-xs">Wait (seconds)</ZoruLabel>
                <ZoruInput
                  type="number"
                  min={0}
                  value={node.waitSeconds ?? 0}
                  onChange={(e) =>
                    onChange({ ...node, waitSeconds: Number.parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-[11px] text-slate-500">
                  e.g. 86400 = 24h, 604800 = 7 days.
                </p>
              </div>
            )}
          </div>
        )}

        {node.kind === "branch" && (
          <div className="space-y-2">
            <ZoruLabel className="text-xs">Branch on</ZoruLabel>
            <ZoruSelect
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
            </ZoruSelect>
            <ZoruLabel className="text-xs">Within (seconds)</ZoruLabel>
            <ZoruInput
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
            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
              <ArrowRight className="h-3 w-3" />
              True → first outgoing edge · False → second.
            </div>
          </div>
        )}

        {!isTerminal && (
          <>
            <ZoruSeparator />
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-800">
                <Settings2 className="h-3 w-3" /> Advanced
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <ZoruLabel className="text-[11px]">Quiet hours start</ZoruLabel>
                    <ZoruInput
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
                    <ZoruLabel className="text-[11px]">Quiet hours end</ZoruLabel>
                    <ZoruInput
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
                    <ZoruLabel className="text-[11px]">Send window start</ZoruLabel>
                    <ZoruInput
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
                    <ZoruLabel className="text-[11px]">Send window end</ZoruLabel>
                    <ZoruInput
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
                  <span className="text-slate-700">Skip on weekends</span>
                  <ZoruSwitch
                    checked={!!node.skipOnWeekend}
                    onCheckedChange={(v) => onChange({ ...node, skipOnWeekend: !!v })}
                  />
                </label>
                <div>
                  <ZoruLabel className="text-[11px]">
                    <Zap className="mr-1 inline h-3 w-3" /> Throttle (msgs/sec)
                  </ZoruLabel>
                  <ZoruInput
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
                  <ZoruLabel className="text-[11px]">
                    <Bell className="mr-1 inline h-3 w-3" /> Provider override
                  </ZoruLabel>
                  <ZoruInput
                    value={node.providerOverride ?? ""}
                    onChange={(e) => onChange({ ...node, providerOverride: e.target.value || undefined })}
                    placeholder="twilio / msg91 / vonage…"
                  />
                </div>
                {node.kind === "message" && (
                  <div className="space-y-1.5 rounded-md border border-slate-100 bg-slate-50 p-2">
                    <div className="text-[11px] font-medium text-slate-700">A/B split</div>
                    <ZoruInput
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
                    <ZoruInput
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
          <div className="flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <div className="space-y-0.5">
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          </div>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}
