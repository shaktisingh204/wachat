'use client';

import * as React from 'react';
import { Button, Textarea, Label } from '@/components/sabcrm/20ui/compat';
import { addCandidateNote } from '@/app/actions/hr-recruitment-mutations.actions';
import { toast } from 'sonner';

export function ScorecardCreator({ candidateId }: { candidateId: string }) {
  const [rating, setRating] = React.useState<number>(0);
  const [feedback, setFeedback] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating.');
      return;
    }
    
    setIsSubmitting(true);
    const scorecardNote = `[SCORECARD] Rating: ${rating}/5\n\nFeedback:\n${feedback}`;
    
    try {
      const result = await addCandidateNote(candidateId, scorecardNote);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Scorecard saved successfully!');
        setRating(0);
        setFeedback('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save scorecard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label className="mb-2 block text-sm font-medium">Overall Rating</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-colors ${
                rating >= star
                  ? 'border-zoru-ink bg-zoru-ink text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zoru-line text-zoru-ink hover:border-zoru-line dark:border-zoru-line'
              }`}
            >
              {star}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block text-sm font-medium">Interview Feedback</Label>
        <Textarea
          placeholder="Technical skills, cultural fit, pros & cons..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          className="w-full resize-none"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || rating === 0} size="sm">
          {isSubmitting ? 'Saving...' : 'Save Scorecard'}
        </Button>
      </div>
    </form>
  );
}
