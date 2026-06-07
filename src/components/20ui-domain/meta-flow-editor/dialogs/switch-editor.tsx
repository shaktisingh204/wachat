'use client';

import { Field, Input, Label, Button, Alert, AlertDescription, AlertTitle } from '@/components/sabcrm/20ui';
import { GitBranch } from 'lucide-react';

/**
 * Meta Flow JSON v7.3 Switch, a control-flow component, not a UI toggle.
 *
 *   { type: "Switch", value: "<expr>", cases: { "<v1>": [...], default: [...] } }
 *
 * Render branches in the raw JSON tab; here we only expose the
 * discriminator value and the case keys.
 */

interface SwitchEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
}

export function SwitchEditor({ component, updateField }: SwitchEditorProps) {
    const cases: Record<string, any[]> = (component.cases && typeof component.cases === 'object') ? component.cases : {};
    const caseKeys = Object.keys(cases);

    const renameCase = (oldKey: string, newKey: string) => {
        if (!newKey || oldKey === newKey) return;
        const next: Record<string, any[]> = {};
        for (const k of caseKeys) next[k === oldKey ? newKey : k] = cases[k];
        updateField('cases', next);
    };
    const addCase = () => {
        const k = `case_${caseKeys.length + 1}`;
        updateField('cases', { ...cases, [k]: [] });
    };
    const removeCase = (key: string) => {
        const next = { ...cases };
        delete next[key];
        updateField('cases', next);
    };

    return (
        <div className="space-y-6">
            <Field
                label="Value expression"
                required
                help="Dynamic expression resolved against screen/form data. Meta matches its string value against the keys below; falls back to the default case."
            >
                <Input
                    id="value"
                    value={component.value || ''}
                    onChange={(e) => updateField('value', e.target.value)}
                    required
                    placeholder="${form.plan}"
                    className="font-mono text-xs"
                />
            </Field>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Cases ({caseKeys.length})</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addCase}>
                        + Add case
                    </Button>
                </div>
                {caseKeys.length === 0 ? (
                    <p className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2 text-[11px] text-[var(--st-text-secondary)]">
                        No cases. Add at least one plus a default case.
                    </p>
                ) : caseKeys.map((k) => (
                    <div key={k} className="flex items-center gap-2">
                        <Input
                            value={k}
                            onChange={(e) => renameCase(k, e.target.value)}
                            aria-label={`Case key for ${k}`}
                            className="font-mono text-xs"
                        />
                        <span className="text-[10.5px] text-[var(--st-text-secondary)]">{cases[k]?.length ?? 0} child</span>
                        {k === 'default' ? null : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCase(k)}
                            >
                                remove
                            </Button>
                        )}
                    </div>
                ))}
            </div>

            <Alert icon={GitBranch}>
                <AlertTitle>Edit branch children in JSON</AlertTitle>
                <AlertDescription>
                    Components inside each case branch are edited in the Raw JSON tab.
                    This panel only configures the switch value and case keys.
                </AlertDescription>
            </Alert>
        </div>
    );
}
