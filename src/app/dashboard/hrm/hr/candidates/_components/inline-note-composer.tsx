'use client';

import * as React from 'react';
import { Button, Textarea } from '@/components/sabcrm/20ui';
import { addCandidateNote } from '@/app/actions/hr-recruitment-mutations.actions';

export function InlineNoteComposer({ candidateId }: { candidateId: string }) {
  const [note, setNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const result = await addCandidateNote(candidateId, note);
      if (result.error) {
        setError(result.error);
      } else {
        setNote('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit note');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        placeholder="Write a note... Use tags like @interviewer to notify them"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        disabled={isSubmitting}
        className="w-full resize-none"
      />
      {error && <p className="text-sm text-[var(--st-text)]">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={!note.trim() || isSubmitting} size="sm">
          {isSubmitting ? 'Saving...' : 'Add Note'}
        </Button>
      </div>
    </form>
  );
}
