"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";

import {
  FIELD_LABELS,
  OPERATOR_LABELS,
  emptyGroup,
  emptyLeaf,
  type SegmentField,
  type SegmentLeaf,
  type SegmentNode,
  type SegmentOperator,
} from "./evaluate";

/**
 * Predicate-canvas — visual builder for the segment AST.
 *
 * Renders the tree as nested cards. Each group exposes an AND/OR
 * toggle, a "+ rule" / "+ group" pair, and a delete affordance. Leaves
 * pick a field, an operator, and a value editor sized to the field
 * type (date, number, multi-select prefix, etc.).
 *
 * The component is intentionally a controlled tree — the parent owns
 * the predicate so undo / import / AI-rewrite all flow through a
 * single setState call.
 */

const FIELDS: SegmentField[] = [
  "e164_prefix",
  "last_sms_clicked_at",
  "total_replies",
  "unsubscribed",
  "engagement_score",
  "tag",
  "source",
  "country",
  "locale",
];

const NUMERIC_FIELDS = new Set<SegmentField>([
  "total_replies",
  "engagement_score",
]);
const DATE_FIELDS = new Set<SegmentField>(["last_sms_clicked_at"]);
const BOOLEAN_FIELDS = new Set<SegmentField>(["unsubscribed"]);

const OPERATORS_BY_FIELD: Record<SegmentField, SegmentOperator[]> = {
  e164_prefix: ["contains", "in", "eq", "neq"],
  last_sms_clicked_at: ["gt", "lt"],
  total_replies: ["eq", "neq", "gt", "lt"],
  unsubscribed: ["eq", "neq"],
  engagement_score: ["eq", "neq", "gt", "lt"],
  tag: ["eq", "neq", "in", "contains"],
  source: ["eq", "neq", "in"],
  country: ["eq", "neq", "in"],
  locale: ["eq", "neq", "in"],
};

export interface PredicateCanvasProps {
  predicate: SegmentNode | null;
  onChange: (next: SegmentNode | null) => void;
}

export function PredicateCanvas({ predicate, onChange }: PredicateCanvasProps) {
  // Treat null / non-group root as a vacuous AND group for editing.
  const root: SegmentNode =
    predicate && predicate.kind === "group" ? predicate : emptyGroup("and");

  function update(path: number[], updater: (node: SegmentNode) => SegmentNode) {
    const next = applyAtPath(root, path, updater);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <GroupNode node={root} path={[]} onUpdate={update} depth={0} />
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ZoruBadge variant="outline" className="text-[10px]">
          ROOT
        </ZoruBadge>
        <span>
          The root group is implicit. Add rules and nested groups to refine
          who matches.
        </span>
      </div>
    </div>
  );
}

interface GroupNodeProps {
  node: SegmentNode;
  path: number[];
  depth: number;
  onUpdate: (path: number[], updater: (node: SegmentNode) => SegmentNode) => void;
}

function GroupNode({ node, path, depth, onUpdate }: GroupNodeProps) {
  if (node.kind !== "group") return null;
  const isRoot = path.length === 0;

  function flipOp() {
    onUpdate(path, (n) =>
      n.kind === "group" ? { ...n, op: n.op === "and" ? "or" : "and" } : n,
    );
  }

  function addLeaf() {
    onUpdate(path, (n) =>
      n.kind === "group" ? { ...n, children: [...n.children, emptyLeaf()] } : n,
    );
  }

  function addGroup() {
    onUpdate(path, (n) =>
      n.kind === "group" ? { ...n, children: [...n.children, emptyGroup("and")] } : n,
    );
  }

  function removeChild(index: number) {
    onUpdate(path, (n) =>
      n.kind === "group"
        ? { ...n, children: n.children.filter((_, i) => i !== index) }
        : n,
    );
  }

  function removeSelf() {
    // Remove this group from its parent — only available on non-root.
    const parentPath = path.slice(0, -1);
    const lastIndex = path[path.length - 1];
    onUpdate(parentPath, (parent) =>
      parent.kind === "group"
        ? { ...parent, children: parent.children.filter((_, i) => i !== lastIndex) }
        : parent,
    );
  }

  const indentClass = depth === 0 ? "" : "ml-4 border-l-2 border-slate-200 pl-4";

  return (
    <div className={`space-y-3 ${indentClass}`}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
        <ZoruSelect
          value={node.op}
          onValueChange={(v) => {
            if (v === "and" || v === "or") {
              onUpdate(path, (n) =>
                n.kind === "group" ? { ...n, op: v } : n,
              );
            }
          }}
        >
          <ZoruSelectTrigger className="w-[100px]">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="and">All of</ZoruSelectItem>
            <ZoruSelectItem value="or">Any of</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
        <span className="text-xs text-slate-500">
          {node.op === "and"
            ? "Contacts matching every rule below."
            : "Contacts matching at least one rule below."}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ZoruButton variant="outline" size="sm" onClick={addLeaf}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Rule
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={addGroup}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Group
          </ZoruButton>
          {!isRoot && (
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={removeSelf}
              aria-label="Remove group"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            </ZoruButton>
          )}
          <ZoruButton
            variant="ghost"
            size="sm"
            onClick={flipOp}
            aria-label="Swap operator"
            className="text-[10px] uppercase"
          >
            ⇄
          </ZoruButton>
        </div>
      </div>

      {node.children.length === 0 ? (
        <p className="ml-2 text-xs italic text-slate-500">
          No rules yet — click "Rule" to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {node.children.map((child, i) => (
            <li key={i} className="relative">
              {child.kind === "leaf" ? (
                <LeafNode
                  node={child}
                  onChange={(next) => {
                    onUpdate(path, (n) =>
                      n.kind === "group"
                        ? {
                            ...n,
                            children: n.children.map((c, idx) =>
                              idx === i ? next : c,
                            ),
                          }
                        : n,
                    );
                  }}
                  onRemove={() => removeChild(i)}
                />
              ) : (
                <GroupNode
                  node={child}
                  path={[...path, i]}
                  depth={depth + 1}
                  onUpdate={onUpdate}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface LeafNodeProps {
  node: SegmentLeaf;
  onChange: (next: SegmentLeaf) => void;
  onRemove: () => void;
}

function LeafNode({ node, onChange, onRemove }: LeafNodeProps) {
  function changeField(field: SegmentField) {
    const allowedOps = OPERATORS_BY_FIELD[field];
    const op = allowedOps.includes(node.op) ? node.op : allowedOps[0];
    let value: unknown = node.value;
    if (BOOLEAN_FIELDS.has(field)) value = false;
    else if (NUMERIC_FIELDS.has(field)) value = 0;
    else value = "";
    onChange({ ...node, field, op, value });
  }

  function changeOp(op: SegmentOperator) {
    onChange({ ...node, op });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
      <ZoruSelect
        value={node.field}
        onValueChange={(v) => changeField(v as SegmentField)}
      >
        <ZoruSelectTrigger className="w-[180px]">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {FIELDS.map((f) => (
            <ZoruSelectItem key={f} value={f}>
              {FIELD_LABELS[f]}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </ZoruSelect>

      <ZoruSelect
        value={node.op}
        onValueChange={(v) => changeOp(v as SegmentOperator)}
      >
        <ZoruSelectTrigger className="w-[140px]">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {OPERATORS_BY_FIELD[node.field].map((o) => (
            <ZoruSelectItem key={o} value={o}>
              {OPERATOR_LABELS[o]}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </ZoruSelect>

      <ValueEditor node={node} onChange={onChange} />

      <ZoruButton
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="Remove rule"
        className="ml-auto"
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
      </ZoruButton>
    </div>
  );
}

function ValueEditor({
  node,
  onChange,
}: {
  node: SegmentLeaf;
  onChange: (next: SegmentLeaf) => void;
}) {
  if (BOOLEAN_FIELDS.has(node.field)) {
    return (
      <ZoruSelect
        value={node.value === true || node.value === "true" ? "true" : "false"}
        onValueChange={(v) => onChange({ ...node, value: v === "true" })}
      >
        <ZoruSelectTrigger className="w-[120px]">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          <ZoruSelectItem value="false">No</ZoruSelectItem>
          <ZoruSelectItem value="true">Yes</ZoruSelectItem>
        </ZoruSelectContent>
      </ZoruSelect>
    );
  }
  if (DATE_FIELDS.has(node.field)) {
    const raw = typeof node.value === "string" ? node.value : "";
    return (
      <ZoruInput
        type="datetime-local"
        value={raw.slice(0, 16)}
        onChange={(e) => onChange({ ...node, value: e.target.value })}
        className="w-[220px]"
      />
    );
  }
  if (NUMERIC_FIELDS.has(node.field)) {
    return (
      <ZoruInput
        type="number"
        value={
          typeof node.value === "number"
            ? String(node.value)
            : typeof node.value === "string"
              ? node.value
              : ""
        }
        onChange={(e) =>
          onChange({ ...node, value: Number(e.target.value) || 0 })
        }
        className="w-[140px]"
      />
    );
  }
  // `in` accepts comma-separated values.
  if (node.op === "in") {
    const raw = Array.isArray(node.value)
      ? node.value.join(", ")
      : typeof node.value === "string"
        ? node.value
        : "";
    return (
      <ZoruInput
        value={raw}
        placeholder="comma, separated, values"
        onChange={(e) => onChange({ ...node, value: e.target.value })}
        className="flex-1 min-w-[180px]"
      />
    );
  }
  return (
    <ZoruInput
      value={typeof node.value === "string" ? node.value : ""}
      placeholder={node.field === "e164_prefix" ? "+1" : "value"}
      onChange={(e) => onChange({ ...node, value: e.target.value })}
      className="flex-1 min-w-[180px]"
    />
  );
}

// ─── Tree path mutation ───────────────────────────────────────────────────

function applyAtPath(
  node: SegmentNode,
  path: number[],
  updater: (node: SegmentNode) => SegmentNode,
): SegmentNode {
  if (path.length === 0) return updater(node);
  if (node.kind !== "group") return node;
  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((c, i) =>
      i === head ? applyAtPath(c, rest, updater) : c,
    ),
  };
}
