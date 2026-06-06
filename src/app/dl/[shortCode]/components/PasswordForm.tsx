'use client';

import { useState } from 'react';
import { verifyLinkPassword } from '@/app/actions/url-shortener.actions';
import { Button } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Lock, Loader2 } from 'lucide-react';
import RedirectScript from './RedirectScript';

interface PasswordFormProps {
    shortCode: string;
}

export default function PasswordForm({ shortCode }: PasswordFormProps) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await verifyLinkPassword(shortCode, password);
            if (result.valid && result.originalUrl) {
                setOriginalUrl(result.originalUrl);
            } else {
                setError(result.error || 'Incorrect password');
            }
        } catch (err) {
            setError('An error occurred while verifying password');
        } finally {
            setLoading(false);
        }
    };

    if (originalUrl) {
        // If password is correct, simulate generic device for redirect
        return <RedirectScript originalUrl={originalUrl} isIos={false} isAndroid={false} />;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="bg-[var(--st-bg-secondary)] text-[var(--st-text)] border rounded-2xl p-8 max-w-md w-full shadow-sm flex flex-col items-center text-center space-y-6">
                <div className="bg-[var(--st-text)]/10 p-4 rounded-full">
                    <Lock className="w-8 h-8 text-[var(--st-text)]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold mb-2">Password Protected</h1>
                    <p className="text-[var(--st-text-secondary)]">
                        This link is protected. Please enter the password to continue.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <Input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full text-center"
                    />
                    
                    {error && (
                        <p className="text-sm text-[var(--st-text)] font-medium">{error}</p>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            'Access Link'
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
