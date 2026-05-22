'use client';

/**
 * Public rating form (client) — submits to `submitProjectRating`.
 *
 * Each category is a 1–5 star row, plus an overall "How would you rate
 * your overall experience?" star input and a comments textarea. Stars
 * are radio buttons styled as `Star` icons so the form remains
 * keyboard-accessible without a custom widget.
 */

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import {
  Button,
  Label,
  Textarea,
  Input,
  cn,
} from '@/components/zoruui';
import {
  submitProjectRating,
  type PublicProjectRatingCategories,
} from '@/app/actions/public-project-rating.actions';

type Props = { hash: string };

const CATEGORIES: { key: keyof PublicProjectRatingCategories; label: string }[] =
  [
    { key: 'communication', label: 'Communication' },
    { key: 'quality', label: 'Quality of work' },
    { key: 'timeliness', label: 'Timeliness' },
    { key: 'value', label: 'Value for money' },
  ];

export function PublicRatingForm({ hash }: Props): React.ReactElement {
  const [overall, setOverall] = useState(0);
  const [categories, setCategories] = useState<PublicProjectRatingCategories>({
    communication: 0,
    quality: 0,
    timeliness: 0,
    value: 0,
  });
  const [comment, setComment] = useState('');
  const [raterName, setRaterName] = useState('');
  const [raterEmail, setRaterEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setCategory = (
    key: keyof PublicProjectRatingCategories,
    value: number,
  ): void => {
    setCategories((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    if (!overall) {
      setError('Please pick an overall rating.');
      return;
    }
    const missing = CATEGORIES.filter((c) => !categories[c.key]);
    if (missing.length > 0) {
      setError(`Please rate: ${missing.map((m) => m.label).join(', ')}.`);
      return;
    }

    startTransition(async () => {
      const res = await submitProjectRating(hash, {
        overall,
        categories,
        comment,
        raterName,
        raterEmail,
      });
      if (res.success) {
        setSubmitted(true);
      } else {
        setError(res.error);
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Thank you!</p>
        <p className="mt-1">Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <section>
        <Label className="text-sm font-semibold text-zinc-900">
          Overall experience
        </Label>
        <p className="mt-0.5 text-xs text-zinc-500">
          How would you rate this project overall?
        </p>
        <div className="mt-2">
          <StarRow
            name="overall"
            value={overall}
            onChange={setOverall}
            size={28}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-zinc-200 p-3">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <Label className="text-sm text-zinc-700">{c.label}</Label>
            <StarRow
              name={`cat-${c.key}`}
              value={categories[c.key]}
              onChange={(v) => setCategory(c.key, v)}
              size={20}
            />
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-sm text-zinc-700">
            Your name (optional)
          </Label>
          <Input
            type="text"
            value={raterName}
            onChange={(e) => setRaterName(e.target.value)}
            maxLength={200}
            className="mt-1"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <Label className="text-sm text-zinc-700">
            Email (optional)
          </Label>
          <Input
            type="email"
            value={raterEmail}
            onChange={(e) => setRaterEmail(e.target.value)}
            maxLength={200}
            className="mt-1"
            placeholder="jane@example.com"
          />
        </div>
      </section>

      <section>
        <Label className="text-sm text-zinc-700">
          Comments (optional)
        </Label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={4000}
          className="mt-1"
          placeholder="What went well? What could we improve?"
        />
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Submitting…' : 'Submit feedback'}
      </Button>
    </form>
  );
}

function StarRow({
  name,
  value,
  onChange,
  size,
}: {
  name: string;
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
      aria-label={name}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onChange(n)}
            className={cn(
              'rounded p-0.5 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
            )}
          >
            <Star
              width={size}
              height={size}
              strokeWidth={1.5}
              className={cn(
                filled ? 'text-amber-500' : 'text-zinc-300',
                'transition-colors',
              )}
              fill={filled ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}
