'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input, Label, Switch, Textarea } from '@/components/zoruui';

/**
 * Tiny reusable "name + JSON-stepsJson + optional switch" form, shared
 * between synthetic scripts and API transactions.
 */
export function JsonEditorForm({
    initialName,
    initialSteps,
    showScreenshotSwitch,
    initialScreenshotOnFailure,
    onSubmit,
    submitLabel,
}: {
    initialName?: string;
    initialSteps?: unknown;
    showScreenshotSwitch?: boolean;
    initialScreenshotOnFailure?: boolean;
    onSubmit: (args: {
        name: string;
        stepsJson: unknown;
        screenshotOnFailure?: boolean;
    }) => Promise<void>;
    submitLabel: string;
}): React.JSX.Element {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [name, setName] = React.useState(initialName ?? '');
    const [stepsRaw, setStepsRaw] = React.useState(
        JSON.stringify(initialSteps ?? [], null, 2),
    );
    const [screenshotOnFailure, setScreenshotOnFailure] = React.useState(
        initialScreenshotOnFailure ?? false,
    );

    const submit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        let parsed: unknown;
        try {
            parsed = stepsRaw.trim() ? JSON.parse(stepsRaw) : [];
        } catch (err) {
            window.alert(`Steps JSON invalid: ${(err as Error).message}`);
            return;
        }
        startTransition(async () => {
            try {
                await onSubmit({
                    name: name.trim(),
                    stepsJson: parsed,
                    screenshotOnFailure: showScreenshotSwitch ? screenshotOnFailure : undefined,
                });
                router.refresh();
            } catch (err) {
                window.alert((err as Error).message);
            }
        });
    };

    return (
        <Card className="zoruui">
            <CardContent className="p-4">
                <form className="flex flex-col gap-4" onSubmit={submit}>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="steps">Steps (JSON array)</Label>
                        <Textarea
                            id="steps"
                            rows={12}
                            value={stepsRaw}
                            onChange={(e) => setStepsRaw(e.target.value)}
                        />
                    </div>
                    {showScreenshotSwitch && (
                        <div className="flex items-center gap-3">
                            <Switch
                                id="screenshot"
                                checked={screenshotOnFailure}
                                onCheckedChange={setScreenshotOnFailure}
                            />
                            <Label htmlFor="screenshot">Capture screenshot on failure</Label>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : submitLabel}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
