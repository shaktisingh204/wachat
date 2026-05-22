'use client';

import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X } from 'lucide-react';

/**
 * <QuestionRepeater /> — structured question builder for HR Surveys.
 *
 * Renders a list of `<QuestionRow />` editors and POSTs the final array
 * as a single hidden `questions` JSON field that
 * `saveSurvey` (`crm-surveys.actions.ts > parseQuestions`) deserialises.
 *
 * Each question is `{ label, type, required, options }`. For choice
 * types (`single_choice`, `multiple_choice`) we render an inline
 * options editor; for others the options control is hidden.
 *
 * No free-text JSON paste: the server still rejects malformed payloads,
 * but users only ever touch the structured fields.
 */

import * as React from 'react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type SurveyQuestionType =
    | 'short_text'
    | 'long_text'
    | 'single_choice'
    | 'multiple_choice'
    | 'rating'
    | 'boolean';

export interface SurveyQuestion {
    label: string;
    type: SurveyQuestionType;
    required?: boolean;
    options?: string[];
}

interface RepeaterItem extends SurveyQuestion {
    /** Stable client-only id for React keys. */
    _key: string;
}

const TYPE_OPTIONS: { value: SurveyQuestionType; label: string }[] = [
    { value: 'short_text', label: 'Short text' },
    { value: 'long_text', label: 'Long text' },
    { value: 'single_choice', label: 'Single choice' },
    { value: 'multiple_choice', label: 'Multiple choice' },
    { value: 'rating', label: 'Rating (1–5)' },
    { value: 'boolean', label: 'Yes / No' },
];

const CHOICE_TYPES: ReadonlySet<SurveyQuestionType> = new Set([
    'single_choice',
    'multiple_choice',
]);

let _counter = 0;
function newKey(): string {
    _counter += 1;
    return `q-${Date.now().toString(36)}-${_counter}`;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export interface QuestionRepeaterProps {
    /** Hidden input name; defaults to `questions`. */
    name?: string;
    /** Seed value when editing an existing survey. */
    initial?: SurveyQuestion[];
}

export function QuestionRepeater({
    name = 'questions',
    initial,
}: QuestionRepeaterProps) {
    const seed = React.useMemo<RepeaterItem[]>(() => {
        if (!initial?.length) return [];
        return initial.map((q) => ({ ...q, _key: newKey() }));
    }, [initial]);
    const [items, setItems] = React.useState<RepeaterItem[]>(seed);

    const payload = React.useMemo(
        () =>
            JSON.stringify(
                items.map(({ _key: _omit, ...rest }) => {
                    void _omit;
                    return rest;
                }),
            ),
        [items],
    );

    const addQuestion = () => {
        setItems((curr) => [
            ...curr,
            { _key: newKey(), label: '', type: 'short_text', required: false },
        ]);
    };

    const updateAt = (idx: number, patch: Partial<RepeaterItem>) => {
        setItems((curr) =>
            curr.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
        );
    };

    const removeAt = (idx: number) => {
        setItems((curr) => curr.filter((_, i) => i !== idx));
    };

    const moveUp = (idx: number) => {
        if (idx <= 0) return;
        setItems((curr) => {
            const next = curr.slice();
            const tmp = next[idx]!;
            next[idx] = next[idx - 1]!;
            next[idx - 1] = tmp;
            return next;
        });
    };

    const moveDown = (idx: number) => {
        setItems((curr) => {
            if (idx >= curr.length - 1) return curr;
            const next = curr.slice();
            const tmp = next[idx]!;
            next[idx] = next[idx + 1]!;
            next[idx + 1] = tmp;
            return next;
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Server payload */}
            <input type="hidden" name={name} value={payload} />

            {items.length === 0 ? (
                <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                    No questions yet. Add your first question to start.
                </div>
            ) : (
                <ul className="flex flex-col gap-3">
                    {items.map((q, idx) => (
                        <li
                            key={q._key}
                            className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4"
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-zoru-ink-muted" />
                                <span className="text-[12px] font-medium text-zoru-ink-muted">
                                    Question {idx + 1}
                                </span>
                                <div className="ml-auto flex items-center gap-1">
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Move up"
                                        onClick={() => moveUp(idx)}
                                        disabled={idx === 0}
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </ZoruButton>
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Move down"
                                        onClick={() => moveDown(idx)}
                                        disabled={idx === items.length - 1}
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </ZoruButton>
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Remove question"
                                        onClick={() => removeAt(idx)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                                <div className="space-y-1.5">
                                    <ZoruLabel htmlFor={`${q._key}-label`}>
                                        Prompt
                                    </ZoruLabel>
                                    <ZoruInput
                                        id={`${q._key}-label`}
                                        value={q.label}
                                        placeholder="What would you like to ask?"
                                        onChange={(e) =>
                                            updateAt(idx, {
                                                label: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <ZoruLabel htmlFor={`${q._key}-type`}>
                                        Answer type
                                    </ZoruLabel>
                                    <ZoruSelect
                                        value={q.type}
                                        onValueChange={(v) =>
                                            updateAt(idx, {
                                                type: v as SurveyQuestionType,
                                                // Clear options when leaving choice types.
                                                options: CHOICE_TYPES.has(
                                                    v as SurveyQuestionType,
                                                )
                                                    ? (q.options ?? [])
                                                    : undefined,
                                            })
                                        }
                                    >
                                        <ZoruSelectTrigger id={`${q._key}-type`}>
                                            <ZoruSelectValue placeholder="Type" />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {TYPE_OPTIONS.map((o) => (
                                                <ZoruSelectItem
                                                    key={o.value}
                                                    value={o.value}
                                                >
                                                    {o.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                            </div>

                            {CHOICE_TYPES.has(q.type) ? (
                                <OptionsEditor
                                    options={q.options ?? []}
                                    onChange={(opts) =>
                                        updateAt(idx, { options: opts })
                                    }
                                />
                            ) : null}

                            <label className="mt-3 flex items-center gap-2 text-[13px] text-zoru-ink">
                                <ZoruCheckbox
                                    checked={!!q.required}
                                    onCheckedChange={(c) =>
                                        updateAt(idx, { required: !!c })
                                    }
                                />
                                Required
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            <div>
                <ZoruButton type="button" variant="outline" onClick={addQuestion}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add question
                </ZoruButton>
            </div>
        </div>
    );
}

/* ─── Options editor (for single/multiple choice) ───────────────────── */

function OptionsEditor({
    options,
    onChange,
}: {
    options: string[];
    onChange: (next: string[]) => void;
}) {
    const addOption = () => onChange([...options, '']);
    const removeAt = (idx: number) =>
        onChange(options.filter((_, i) => i !== idx));
    const updateAt = (idx: number, value: string) =>
        onChange(options.map((o, i) => (i === idx ? value : o)));

    return (
        <div className="mt-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3">
            <div className="mb-2 text-[12px] font-medium text-zoru-ink-muted">
                Options
            </div>
            {options.length === 0 ? (
                <p className="mb-2 text-[12px] text-zoru-ink-muted">
                    No options yet — add at least one.
                </p>
            ) : (
                <ul className="mb-2 flex flex-col gap-2">
                    {options.map((opt, i) => (
                        <li key={i} className="flex items-center gap-2">
                            <ZoruInput
                                value={opt}
                                placeholder={`Option ${i + 1}`}
                                onChange={(e) => updateAt(i, e.target.value)}
                            />
                            <ZoruButton
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove option ${i + 1}`}
                                onClick={() => removeAt(i)}
                            >
                                <X className="h-4 w-4" />
                            </ZoruButton>
                        </li>
                    ))}
                </ul>
            )}
            <ZoruButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={addOption}
            >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add option
            </ZoruButton>
        </div>
    );
}
