'use client';

import { useState } from 'react';
import { Card, ZoruCardContent, Button, Textarea } from '@/components/sabcrm/20ui/compat';
import { MessageSquare, ThumbsDown, Loader2, Send } from 'lucide-react';
import { addProposalComment, declineProposal } from './_actions';

export function ProposalNegotiation({ token }: { token: string }) {
  const [comment, setComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComment = async () => {
    if (!comment.trim()) return;
    setIsCommenting(true);
    setError(null);
    const res = await addProposalComment(token, comment);
    if (!res.success) {
      setError(res.error || 'Failed to add comment');
    } else {
      setComment('');
    }
    setIsCommenting(false);
  };

  const handleDecline = async () => {
    if (!comment.trim()) {
      setError('Please provide a reason for declining in the comment box.');
      return;
    }
    setIsDeclining(true);
    setError(null);
    const res = await declineProposal(token, comment);
    if (!res.success) {
      setError(res.error || 'Failed to decline proposal');
    } else {
      setComment('');
    }
    setIsDeclining(false);
  };

  return (
    <Card className="border-[var(--st-border)] shadow-sm mt-6">
      <ZoruCardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
          <MessageSquare className="h-4 w-4" />
          <h3 className="font-mono text-[12px] uppercase tracking-wider font-bold">Negotiation & Comments</h3>
        </div>
        
        <Textarea
          placeholder="Type your questions, negotiation terms, or reason for declining here..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isCommenting || isDeclining}
          className="min-h-[100px] font-mono text-[13px] leading-relaxed"
        />

        {error && (
          <p className="text-danger text-[12px] font-mono font-medium">{error}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDecline}
            disabled={isDeclining || isCommenting}
            className="font-mono text-[12px] h-9"
          >
            {isDeclining ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />}
            Decline Proposal
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleComment}
            disabled={isCommenting || isDeclining || !comment.trim()}
            className="font-mono text-[12px] h-9"
          >
            {isCommenting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Send Comment
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
