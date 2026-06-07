'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { FEATURE_CATEGORIES } from '@/lib/features/types';
import {
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

interface FilterBarProps {
  query: string;
  setQuery: (q: string) => void;
  category: string;
  setCategory: (c: string) => void;
  sort: string;
  setSort: (s: string) => void;
}

export function FilterBar({ query, setQuery, category, setCategory, sort, setSort }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Field label="Search" className="flex-1">
          <Input
            type="text"
            placeholder="Search features (try 'error' to simulate failure)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            iconLeft={Search}
          />
        </Field>

        <Field label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {FEATURE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Sort">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort features">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default order</SelectItem>
              <SelectItem value="name-asc">Name, A to Z</SelectItem>
              <SelectItem value="name-desc">Name, Z to A</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}
