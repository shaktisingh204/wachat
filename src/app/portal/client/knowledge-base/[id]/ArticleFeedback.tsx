'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  useToast,
} from '@/components/sabcrm/20ui';
import { submitArticleFeedback } from './actions';

export function ArticleFeedback({ articleId }: { articleId: string }) {
  const { toast } = useToast();
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
    <Card variant="outlined" className="mt-8">
      <CardHeader className="items-center text-center">
        <CardTitle>Was this article helpful?</CardTitle>
      </CardHeader>
      <CardBody>
        {status === 'voted' ? (
          <p className="text-center text-sm text-[var(--st-text-secondary)]">
            Thanks for letting us know!
          </p>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={vote === true ? 'primary' : 'outline'}
              iconLeft={ThumbsUp}
              loading={status === 'loading'}
              onClick={() => handleVote(true)}
            >
              Yes
            </Button>
            <Button
              variant={vote === false ? 'primary' : 'outline'}
              iconLeft={ThumbsDown}
              loading={status === 'loading'}
              onClick={() => handleVote(false)}
            >
              No
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
