'use client';

import * as React from 'react';

import type { SabbackstageSponsorDoc } from '@/lib/rust-client/sabbackstage-sponsors';

export function PublicSponsorStrip({
  sponsors,
}: {
  sponsors: SabbackstageSponsorDoc[];
}): React.JSX.Element {
  return (
    <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-5">
      {sponsors.map((s) => (
        <a
          key={s._id}
          href={s.websiteUrl ?? '#'}
          target={s.websiteUrl ? '_blank' : undefined}
          rel="noreferrer"
          className="flex h-20 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-3"
          title={`${s.name} · ${s.tier}`}
        >
          {s.logoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/sabfiles/${s.logoFileId}`}
              alt={s.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-sm opacity-80">{s.name}</span>
          )}
        </a>
      ))}
    </div>
  );
}
