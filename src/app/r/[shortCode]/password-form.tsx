'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
            <body style={{ fontFamily: 'sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: 0, backgroundColor: '#f9fafb' }}>
                <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
                    <h1 style={{ fontSize: '1.25rem', color: '#111827', margin: '0 0 1rem 0' }}>Password Protected</h1>
                    <p style={{ color: '#4b5563', marginBottom: '1.5rem', fontSize: '0.875rem' }}>This link requires a password to access.</p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            style={{ padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box' }}
                            required
                        />
                        {hasError && <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>Incorrect password. Please try again.</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '0.75rem',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontWeight: '500',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Verifying...' : 'Submit'}
                        </button>
                    </form>
                </div>
            </body>
        </html>
    );
}
