'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

import { Button, Card, CardBody, Field, Input } from '@/components/sabcrm/20ui';

export function PasswordForm({ shortCode, hasError }: { shortCode: string, hasError?: boolean }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Append pwd to the search params so the page reloads with it and passes it to the server action
        router.replace(`/r/${shortCode}?pwd=${encodeURIComponent(password)}`);
    };

    return (
        <html lang="en">
            <head><title>Password Protected Link</title></head>
            <body>
                <div className="ui20 flex min-h-screen items-center justify-center bg-[var(--st-bg-secondary)] p-6">
                    <Card variant="elevated" padding="none" className="w-full max-w-[400px]">
                        <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
                            <span
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-accent)]"
                                aria-hidden="true"
                            >
                                <Lock size={22} />
                            </span>
                            <div className="flex flex-col gap-1">
                                <h1 className="text-lg font-semibold text-[var(--st-text)]">Password Protected</h1>
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    This link requires a password to access.
                                </p>
                            </div>
                            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
                                <Field
                                    label="Password"
                                    error={hasError ? 'Incorrect password. Please try again.' : undefined}
                                >
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        autoFocus
                                        required
                                    />
                                </Field>
                                <Button type="submit" variant="primary" block loading={loading}>
                                    {loading ? 'Verifying...' : 'Submit'}
                                </Button>
                            </form>
                        </CardBody>
                    </Card>
                </div>
            </body>
        </html>
    );
}
