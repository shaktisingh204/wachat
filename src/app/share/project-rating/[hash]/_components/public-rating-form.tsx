'use client';

/**
 * Public rating form (client) - submits to `submitProjectRating`.
 *
 * Each category is a 1-5 star row, plus an overall "How would you rate
 * your overall experience?" star input and a comments textarea. Stars
 * are icon buttons exposing radio semantics (role="radio" + aria-checked)
 * so the form stays keyboard-accessible without a bespoke widget.
 */

import { useState, useTransition } from 'react';
import { Star, Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Label,
  Field,
  Input,
  Textarea,
  Card,
  CardTitle,
  Alert,
} from '@/components/sabcrm/20ui';
import {
  submitProjectRating,
  type PublicProjectRatingCategories,
  type SyndicationUrl,
} from '@/app/actions/public-project-rating.actions';

type Props = {
  hash: string;
  alreadyRated?: boolean;
  existingRating?: { overall: number; comment: string };
  syndicationUrls?: SyndicationUrl[];
};

const CATEGORIES: { key: keyof PublicProjectRatingCategories; label: string }[] =
  [
    { key: 'communication', label: 'Communication' },
    { key: 'quality', label: 'Quality of work' },
    { key: 'timeliness', label: 'Timeliness' },
    { key: 'value', label: 'Value for money' },
  ];

export function PublicRatingForm({
  hash,
  alreadyRated,
  existingRating,
  syndicationUrls = [],
}: Props): React.ReactElement {
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
  const [submitted, setSubmitted] = useState(Boolean(alreadyRated));
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const finalOverall = alreadyRated ? existingRating?.overall ?? 0 : overall;
  const finalComment = alreadyRated ? existingRating?.comment ?? '' : comment;

  const handleCopy = async () => {
    if (!finalComment) return;
    try {
      await navigator.clipboard.writeText(finalComment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

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
    const isPositive = finalOverall >= 4;
    const hasSyndication = isPositive && syndicationUrls.length > 0;

    return (
      <div className="space-y-4">
        <Alert tone="success" title="Thank you!">
          {alreadyRated
            ? "You've already submitted feedback for this project."
            : 'Your feedback has been recorded.'}
        </Alert>

        {hasSyndication && (
          <Card variant="elevated" padding="md">
            <CardTitle>Share your experience</CardTitle>
            <p className="mt-1 text-sm text-[var(--st-text)]">
              We appreciate your positive feedback! It would mean the world to
              us if you could share it on these platforms:
            </p>

            {finalComment.trim().length > 0 && (
              <div className="group relative mt-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
                <p className="whitespace-pre-wrap pr-20">{finalComment}</p>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  iconLeft={copied ? CheckCircle2 : Copy}
                  className="absolute right-2 top-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={handleCopy}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {syndicationUrls.map((link) => (
                <Button
                  key={link.url}
                  variant="outline"
                  iconRight={ExternalLink}
                  onClick={() =>
                    window.open(link.url, '_blank', 'noopener,noreferrer')
                  }
                >
                  {link.platform}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <section>
        <Label className="text-sm font-semibold text-[var(--st-text)]">
          Overall experience
        </Label>
        <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
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

      <section className="space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <Label className="text-sm text-[var(--st-text)]">{c.label}</Label>
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
        <Field label="Your name (optional)">
          <Input
            type="text"
            value={raterName}
            onChange={(e) => setRaterName(e.target.value)}
            maxLength={200}
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Email (optional)">
          <Input
            type="email"
            value={raterEmail}
            onChange={(e) => setRaterEmail(e.target.value)}
            maxLength={200}
            placeholder="jane@example.com"
          />
        </Field>
      </section>

      <Field label="Comments (optional)">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="What went well? What could we improve?"
        />
      </Field>

      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        loading={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Submitting...' : 'Submit feedback'}
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
