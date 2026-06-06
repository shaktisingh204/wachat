'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input, Progress } from '@/components/sabcrm/20ui';

interface PhaseHeaderProps {
  name: string;
  doneCount: number;
  totalCount: number;
  progressPercent: number;
  onRename: (newName: string) => void;
}

export function PhaseHeader({
  name,
  doneCount,
  totalCount,
  progressPercent,
  onRename,
}: PhaseHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const commitRename = () => {
    setIsEditing(false);
    if (localName.trim() && localName.trim() !== name) {
      onRename(localName.trim());
    } else {
      setLocalName(name); // revert
    }
  };

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--st-border)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setLocalName(name);
                setIsEditing(false);
              }
            }}
            className="h-7 w-full border-[var(--st-border)] bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-[var(--st-text)]"
          />
        ) : (
          <div
            className="h-7 flex-1 cursor-text truncate px-1 text-sm font-semibold leading-7 text-[var(--st-text)] hover:bg-[var(--st-hover)] rounded"
            onClick={() => setIsEditing(true)}
          >
            {name}
          </div>
        )}
        <span className="shrink-0 text-xs text-[var(--st-text-secondary)] tabular-nums">
          {doneCount}/{totalCount}
        </span>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
    </div>
  );
}
