'use client';

import { useState } from 'react';
import { submitArticleFeedback } from './actions';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

export function ArticleFeedback({ articleId }: { articleId: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'voted'>('idle');
    const [vote, setVote] = useState<boolean | null>(null);

    const handleVote = async (helpful: boolean) => {
        if (status === 'loading') return;
        setStatus('loading');
        const res = await submitArticleFeedback(articleId, helpful);
        if (res.error) {
            toast.error(res.error);
            setStatus('idle');
        } else {
            setVote(helpful);
            setStatus('voted');
            toast.success('Thank you for your feedback!');
        }
    };

    return (
        <div className="mt-8 flex flex-col items-center justify-center p-6 bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)]">
            <h3 className="text-sm font-medium mb-4 text-[var(--st-text)]">Was this article helpful?</h3>
            {status === 'voted' ? (
                <p className="text-sm text-[var(--st-text-secondary)]">
                    Thanks for letting us know!
                </p>
            ) : (
                <div className="flex gap-4">
                    <button
                        onClick={() => handleVote(true)}
                        disabled={status === 'loading'}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] hover:bg-[var(--st-bg-muted)] transition-colors disabled:opacity-50"
                    >
                        <ThumbsUp className="w-4 h-4" />
                        Yes
                    </button>
                    <button
                        onClick={() => handleVote(false)}
                        disabled={status === 'loading'}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] hover:bg-[var(--st-bg-muted)] transition-colors disabled:opacity-50"
                    >
                        <ThumbsDown className="w-4 h-4" />
                        No
                    </button>
                </div>
            )}
        </div>
    );
}
