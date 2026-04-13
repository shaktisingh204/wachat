'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GitBranch } from 'lucide-react';

/**
 * Meta Flow JSON v7.3 Switch — a control-flow component, not a UI toggle.
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
            <div className="space-y-2">
                <Label htmlFor="value">Value expression</Label>
                <Input
                    id="value"
                    value={component.value || ''}
                    onChange={(e) => updateField('value', e.target.value)}
                    required
                    placeholder="${form.plan}"
                    className="font-mono text-xs"
                />
                <p className="text-[10.5px] text-muted-foreground">
                    Dynamic expression resolved against screen/form data. Meta matches its
                    string value against the keys below; falls back to <code>default</code>.
                </p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Cases ({caseKeys.length})</Label>
                    <button type="button" onClick={addCase} className="text-[11px] font-medium text-primary hover:underline">
                        + Add case
                    </button>
                </div>
                {caseKeys.length === 0 ? (
                    <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
                        No cases. Add at least one plus a <code>default</code>.
                    </p>
                ) : caseKeys.map((k) => (
                    <div key={k} className="flex items-center gap-2">
                        <Input
                            value={k}
                            onChange={(e) => renameCase(k, e.target.value)}
                            className="font-mono text-xs"
                        />
                        <span className="text-[10.5px] text-muted-foreground">{cases[k]?.length ?? 0} child</span>
                        {k === 'default' ? null : (
                            <button
                                type="button"
                                onClick={() => removeCase(k)}
                                className="text-[11px] text-destructive hover:underline"
                            >
                                remove
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <Alert>
                <GitBranch className="h-4 w-4" />
                <AlertTitle>Edit branch children in JSON</AlertTitle>
                <AlertDescription>
                    Components inside each case branch are edited in the Raw JSON tab.
                    This panel only configures the switch value and case keys.
                </AlertDescription>
            </Alert>
        </div>
    );
}
