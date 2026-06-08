'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Braces } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Field,
    Input,
    Switch,
    Textarea,
    Separator,
    useToast,
} from '@/components/sabcrm/20ui';

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
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [name, setName] = React.useState(initialName ?? '');
    const [stepsRaw, setStepsRaw] = React.useState(
        JSON.stringify(initialSteps ?? [], null, 2),
    );
    const [stepsError, setStepsError] = React.useState<string | null>(null);
    const [screenshotOnFailure, setScreenshotOnFailure] = React.useState(
        initialScreenshotOnFailure ?? false,
    );

    const submit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        let parsed: unknown;
        try {
            parsed = stepsRaw.trim() ? JSON.parse(stepsRaw) : [];
            setStepsError(null);
        } catch (err) {
            const message = `Steps JSON invalid: ${(err as Error).message}`;
            setStepsError(message);
            toast.error(message);
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
                toast.error((err as Error).message);
            }
        });
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={submit}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Braces className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Definition
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="flex flex-col gap-4">
                    <Field label="Name" required>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </Field>
                    <Field
                        label="Steps (JSON array)"
                        help="An ordered array of step objects, run top to bottom."
                        error={stepsError ?? undefined}
                    >
                        <Textarea
                            className="font-mono text-[12px]"
                            rows={12}
                            value={stepsRaw}
                            onChange={(e) => {
                                setStepsRaw(e.target.value);
                                if (stepsError) setStepsError(null);
                            }}
                        />
                    </Field>
                    {showScreenshotSwitch && (
                        <Switch
                            checked={screenshotOnFailure}
                            onCheckedChange={setScreenshotOnFailure}
                            label="Capture screenshot on failure"
                        />
                    )}
                </CardBody>
            </Card>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] py-3">
                <Button type="submit" variant="primary" loading={pending}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
