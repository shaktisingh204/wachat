'use client';

/**
 * Record detail drawer — opens when a row's row-number is clicked.
 * Shows every field as an editable row, with attachment fields routed
 * through SabFiles per project policy.
 */

import { useEffect, useState, useTransition } from 'react';

import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  createSabtablesComment,
  listSabtablesComments,
} from '@/app/actions/sabtables.actions';
import type {
  SabtablesField,
  SabtablesTableDoc,
} from '@/lib/rust-client/sabtables-tables';
import type { SabtablesRecordDoc } from '@/lib/rust-client/sabtables-records';
import type { SabtablesCommentDoc } from '@/lib/rust-client/sabtables-comments';

interface Props {
  open: boolean;
  record: SabtablesRecordDoc | null;
  table: SabtablesTableDoc;
  onClose: () => void;
  onCellChange: (recordId: string, fieldId: string, value: unknown) => void;
}

export function RecordDetailDrawer({
  open,
  record,
  table,
  onClose,
  onCellChange,
}: Props) {
  const [comments, setComments] = useState<SabtablesCommentDoc[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!record) return;
    listSabtablesComments(record._id)
      .then((res) => setComments(res.items))
      .catch(() => setComments([]));
  }, [record]);

  if (!record) return null;

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabtablesComment({
          recordId: record._id,
          tableId: record.tableId,
          body: commentBody.trim(),
        });
        setComments((prev) => [...prev, res.entity]);
        setCommentBody('');
      } catch (err) {
        console.error('[sabtables] createComment failed', err);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <SheetContent side="right" className="w-[480px] sm:w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record details</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {table.fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              value={record.fieldsJson[f.id]}
              onChange={(v) => onCellChange(record._id, f.id, v)}
            />
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <div className="font-medium">Comments</div>
          <div className="space-y-2">
            {comments.length === 0 ? (
              <div className="text-sm text-[var(--st-text-secondary)]">No comments yet.</div>
            ) : (
              comments.map((c) => (
                <div key={c._id} className="text-sm">
                  <div className="font-medium text-xs text-[var(--st-text-secondary)]">
                    {new Date(c.createdAt ?? '').toLocaleString()}
                  </div>
                  <div>{c.body}</div>
                </div>
              ))
            )}
          </div>
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <Button size="sm" onClick={handleAddComment} disabled={!commentBody.trim()}>
            Comment
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: SabtablesField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
        {field.name}
      </Label>
      <FieldEditor field={field} value={value} onChange={onChange} />
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: SabtablesField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.fieldType) {
    case 'long_text':
      return (
        <Textarea
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      );
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'attachment': {
      const files = (value as Array<{ id?: string; url?: string; name?: string }> | undefined) ?? [];
      return (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="text-sm border rounded-md px-2 py-1">
              {f.name || f.url || 'File'}
            </div>
          ))}
          <SabFilePickerButton
            onPick={(pick) => {
              const next = [
                ...files,
                { id: pick.id, url: pick.url, name: pick.name },
              ];
              onChange(next);
            }}
          >
            Attach from SabFiles
          </SabFilePickerButton>
        </div>
      );
    }
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'duration':
    case 'autonumber':
      return (
        <Input
          type="number"
          value={(value as number | undefined) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'datetime':
      return (
        <Input
          type="datetime-local"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'formula':
    case 'lookup':
    case 'rollup':
    case 'count':
    case 'created_by':
    case 'created_at':
    case 'updated_by':
    case 'updated_at':
      return (
        <div className="text-sm text-[var(--st-text-secondary)]">
          {value == null ? '—' : String(value)}
        </div>
      );
    default:
      return (
        <Input
          type={field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : 'text'}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
