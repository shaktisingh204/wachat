'use client';

/**
 * Record detail drawer - opens when a row's row-number is clicked.
 * Shows every field as an editable row, with attachment fields routed
 * through SabFiles per project policy.
 */

import { useEffect, useState, useTransition } from 'react';

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Field,
  Input,
  Textarea,
  Checkbox,
  Separator,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { MessageSquare, ListChecks } from 'lucide-react';
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

        <section aria-label="Fields" className="py-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            Fields
          </h3>
          <div className="space-y-4">
            {table.fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                value={record.fieldsJson[f.id]}
                onChange={(v) => onCellChange(record._id, f.id, v)}
              />
            ))}
          </div>
        </section>

        <Separator />

        <section aria-label="Comments" className="space-y-3 pt-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Comments
          </h3>
          {comments.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              size="sm"
              title="No comments yet"
              description="Be the first to leave a note on this record."
            />
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c._id} className="text-sm">
                  <div className="text-xs font-medium text-[var(--st-text-secondary)] tabular-nums">
                    {new Date(c.createdAt ?? '').toLocaleString()}
                  </div>
                  <div className="text-[var(--st-text)]">{c.body}</div>
                </li>
              ))}
            </ul>
          )}
          <Field label="Add a comment">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a note for your team."
              rows={2}
            />
          </Field>
          <Button
            size="sm"
            variant="primary"
            iconLeft={MessageSquare}
            onClick={handleAddComment}
            disabled={!commentBody.trim()}
          >
            Comment
          </Button>
        </section>
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
    <Field
      label={
        <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
          {field.name}
        </span>
      }
    >
      <FieldEditor field={field} value={value} onChange={onChange} />
    </Field>
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
        <Checkbox
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'attachment': {
      const files = (value as Array<{ id?: string; url?: string; name?: string }> | undefined) ?? [];
      return (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="text-sm border border-[var(--st-border)] rounded-[var(--st-radius)] px-2 py-1 text-[var(--st-text)]"
            >
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
          {value == null ? '-' : String(value)}
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
