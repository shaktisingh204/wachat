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
      <div className="flex items-center gap-2 text-xs text-zoru-ink">
        <Badge variant="outline" className="text-[10px]">
          ROOT
        </Badge>
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

  const depthColors = [
    "border-zoru-line bg-white",
    "border-zoru-line bg-zoru-surface-2/30",
    "border-zoru-line bg-zoru-surface-2/30",
    "border-zoru-line bg-zoru-surface-2/30",
    "border-zoru-line bg-zoru-surface-2/30",
  ];
  const colorClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div className={`space-y-3 rounded-lg border p-3 ${colorClass} ${!isRoot ? "shadow-sm" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={node.op}
          onValueChange={(v) => {
            if (v === "and" || v === "or") {
              onUpdate(path, (n) =>
                n.kind === "group" ? { ...n, op: v } : n,
              );
            }
          }}
        >
          <ZoruSelectTrigger className="w-[100px] h-8 bg-white font-medium">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="and">All of</ZoruSelectItem>
            <ZoruSelectItem value="or">Any of</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
        <span className="text-xs text-zoru-ink font-medium">
          {node.op === "and"
            ? "Contacts matching every rule below."
            : "Contacts matching at least one rule below."}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 bg-white" onClick={addLeaf}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Rule
          </Button>
          <Button variant="outline" size="sm" className="h-8 bg-white" onClick={addGroup}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Group
          </Button>
          {!isRoot && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-zoru-ink hover:bg-zoru-surface-2 hover:text-zoru-ink"
              onClick={removeSelf}
              aria-label="Remove group"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[10px] uppercase font-bold"
            onClick={flipOp}
            aria-label="Swap operator"
          >
            ⇄
          </Button>
        </div>
      </div>

      {node.children.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-dashed border-zoru-line bg-zoru-surface-2/50 p-4 text-xs italic text-zoru-ink">
          No rules yet — click "Rule" to add one.
        </div>
      ) : (
        <div className="space-y-3 pl-2">
          {node.children.map((child, i) => (
            <div key={i} className="relative">
              {/* Optional connector line for deep levels could go here, but the nested boxes are clearer */}
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
            </div>
          ))}
        </div>
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
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-zoru-line bg-white p-2">
      <Select
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
      </Select>

      <Select
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
      </Select>

      <ValueEditor node={node} onChange={onChange} />

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="Remove rule"
        className="ml-auto"
      >
        <Trash2 className="h-3.5 w-3.5 text-zoru-ink" />
      </Button>
    </div>
  );
}

import { getFieldOptions } from "./actions";

function ValueEditor({
  node,
  onChange,
}: {
  node: SegmentLeaf;
  onChange: (next: SegmentLeaf) => void;
}) {
  const [options, setOptions] = React.useState<string[]>([]);
  const isAutocompleteField = ["tag", "source", "country", "locale"].includes(node.field);

  React.useEffect(() => {
    if (!isAutocompleteField) return;
    let active = true;
    getFieldOptions(node.field as any).then((res) => {
      if (active && res.ok) setOptions(res.options);
    });
    return () => {
      active = false;
    };
  }, [node.field, isAutocompleteField]);

  const listId = React.useId();

  if (BOOLEAN_FIELDS.has(node.field)) {
    return (
      <Select
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
      </Select>
    );
  }
  if (DATE_FIELDS.has(node.field)) {
    const raw = typeof node.value === "string" ? node.value : "";
    return (
      <Input
        type="datetime-local"
        value={raw.slice(0, 16)}
        onChange={(e) => onChange({ ...node, value: e.target.value })}
        className="w-[220px]"
      />
    );
  }
  if (NUMERIC_FIELDS.has(node.field)) {
    return (
      <Input
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
      <div className="relative flex-1">
        <Input
          value={raw}
          list={isAutocompleteField ? listId : undefined}
          placeholder="comma, separated, values"
          onChange={(e) => onChange({ ...node, value: e.target.value })}
          className="min-w-[180px] w-full"
        />
        {isAutocompleteField && options.length > 0 && (
          <datalist id={listId}>
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        )}
      </div>
    );
  }
  return (
    <div className="relative flex-1">
      <Input
        value={typeof node.value === "string" ? node.value : ""}
        list={isAutocompleteField ? listId : undefined}
        placeholder={node.field === "e164_prefix" ? "+1" : "value"}
        onChange={(e) => onChange({ ...node, value: e.target.value })}
        className="min-w-[180px] w-full"
      />
      {isAutocompleteField && options.length > 0 && (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </div>
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
