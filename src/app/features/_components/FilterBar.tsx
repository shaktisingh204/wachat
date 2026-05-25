'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { FEATURE_CATEGORIES } from '@/lib/features/types';

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
    <div className="flex flex-col gap-4 p-4 border border-black bg-gray-50">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search features (try 'error' to simulate failure)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-black pl-10 pr-4 py-2 text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-black bg-white"
          />
        </div>
        
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-black px-4 py-2 text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="all">ALL CATEGORIES</option>
          {FEATURE_CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
        
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border border-black px-4 py-2 text-sm uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-black bg-white"
        >
          <option value="default">SORT: DEFAULT</option>
          <option value="name-asc">SORT: A-Z</option>
          <option value="name-desc">SORT: Z-A</option>
        </select>
      </div>
    </div>
  );
}
