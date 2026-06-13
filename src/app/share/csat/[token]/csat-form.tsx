'use client';

/**
 * Public CSAT survey form (client) — submits to `submitCsatPublic`.
 *
 * A 1–5 star overall score (keyboard-accessible radiogroup, modelled on the
 * project-rating form's StarRow) plus an optional comment and a hidden honeypot
 * field (`website`) that a real user never fills — a bot that does is rejected
 * server-side. No auth: the 32-char token in the URL carries the tenant + case.
 */

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';

import {
  Button,
  Label,
  Field,
  Textarea,
  Alert,
} from '@/components/sabcrm/20ui';
import { submitCsatPublic } from '@/app/actions/sabcrm-cases.actions';

type Props = {
  token: string;
  alreadySubmitted?: boolean;
  existing?: { score: number; comment: string };
};

export function CsatSurveyForm({
  token,
  alreadySubmitted,
  existing,
}: Props): React.ReactElement {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(Boolean(alreadySubmitted));
  const [isPending, startTransition] = useTransition();

  const finalScore = alreadySubmitted ? existing?.score ?? 0 : score;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (!score) {
      setError('Please pick a rating from 1 to 5.');
      return;
    }
    startTransition(async () => {
      const res = await submitCsatPublic({ token, score, comment, website });
      if (res.success) setSubmitted(true);
      else setError(res.error);
    });
  };

  if (submitted) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Thank you!">
          {alreadySubmitted
            ? "You've already submitted feedback for this case."
            : 'Your feedback has been recorded.'}
        </Alert>
        {finalScore > 0 ? (
          <div
            className="flex items-center gap-1"
            aria-label={`You rated ${finalScore} out of 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                width={22}
                height={22}
                strokeWidth={1.5}
                fill={n <= finalScore ? 'currentColor' : 'none'}
                className={
                  n <= finalScore
                    ? 'text-[var(--st-accent)]'
                    : 'text-[var(--st-text-tertiary)]'
                }
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {/* Honeypot — visually hidden, off the tab order, autofill-disabled. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="csat-website">Leave this field empty</label>
        <input
          id="csat-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <section>
        <Label className="text-sm font-semibold text-[var(--st-text)]">
          Overall satisfaction
        </Label>
        <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
          How satisfied are you with how we handled your case?
        </p>
        <div className="mt-2">
          <StarRow value={score} onChange={setScore} size={28} />
        </div>
      </section>

      <Field label="Comments (optional)">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Tell us more about your experience…"
        />
      </Field>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button
        type="submit"
        variant="primary"
        loading={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Submitting…' : 'Submit feedback'}
      </Button>
    </form>
  );
}

function StarRow({
  value,
  onChange,
  size,
}: {
  value: number;
  onChange: (v: number) => void;
  size: number;
}): React.ReactElement {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="radiogroup"
      aria-label="Overall satisfaction"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        return (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="sm"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange(n)}
            className="!h-auto !w-auto !px-1.5 !py-1"
          >
            <Star
              width={size}
              height={size}
              strokeWidth={1.5}
              fill={filled ? 'currentColor' : 'none'}
              className={
                filled
                  ? 'text-[var(--st-accent)]'
                  : 'text-[var(--st-text-tertiary)]'
              }
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}
