import * as React from 'react';
import type { Metadata } from 'next';

import { CategoriesPageClient } from '../_components/categories-page-client';

export const metadata: Metadata = { title: 'Group Categories — SabWa' };

export default function GroupCategoriesPage() {
  return <CategoriesPageClient />;
}
