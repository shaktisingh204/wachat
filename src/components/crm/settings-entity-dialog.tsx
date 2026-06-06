'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
} from '@/components/sabcrm/20ui/compat';
import {
  LoaderCircle } from 'lucide-react';

/**
 * Inline create/edit dialog used by <SettingsEntityShell>. Extracted
 * to keep the shell file under the 600-line budget.
 */

import * as React from 'react';

import {
    FieldRenderer,
    formatFieldValue,
    type SettingsField,
} from '@/components/crm/settings-entity-shell-field';

export interface SettingsEntityDialogProps<T extends { _id: string }> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    singular: string;
    editing: T | null;
    fields: SettingsField[];
    formAction: (formData: FormData) => void;
    isSaving: boolean;
    entityValues: Record<string, string>;
    onEntityChange: (name: string, id: string | null) => void;
    hiddenInputs?: (editing: T | null) => React.ReactNode;
}

export function SettingsEntityDialog<T extends { _id: string; [k: string]: any }>(
    props: SettingsEntityDialogProps<T>,
) {
    const {
        open,
        onOpenChange,
        singular,
        editing,
        fields,
        formAction,
        isSaving,
        entityValues,
        onEntityChange,
        hiddenInputs,
    } = props;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-2xl">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>
                        {editing ? `Edit ${singular}` : `New ${singular}`}
                    </ZoruDialogTitle>
                    <ZoruDialogDescription>
                        {editing
                            ? 'Update the details and save.'
                            : 'Fill in the details below.'}
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form action={formAction} className="space-y-4">
                    {editing?._id ? (
                        <input type="hidden" name="_id" value={editing._id} />
                    ) : null}
                    {hiddenInputs?.(editing)}
                    <div className="grid gap-4 md:grid-cols-2">
                        {fields.map((field) => (
                            <div
                                key={field.name}
                                className={field.fullWidth ? 'md:col-span-2' : ''}
                            >
                                <Label htmlFor={field.name}>
                                    {field.label}
                                    {field.required ? (
                                        <span className="text-[var(--st-danger)]"> *</span>
                                    ) : null}
                                </Label>
                                <div className="mt-1.5">
                                    <FieldRenderer
                                        field={field}
                                        value={
                                            editing
                                                ? formatFieldValue(
                                                      editing[field.name],
                                                      field.type,
                                                  )
                                                : undefined
                                        }
                                        entityValues={entityValues}
                                        onEntityChange={onEntityChange}
                                    />
                                </div>
                                {field.help ? (
                                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                        {field.help}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    <ZoruDialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : null}
                            Save
                        </Button>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
