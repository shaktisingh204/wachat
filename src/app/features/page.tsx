import * as React from 'react';
import type { Metadata } from 'next';
import { FeatureHeader, FeatureFooter } from '@/components/features/FeatureChrome';
import { FeaturesClient } from './_components/FeaturesClient';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sabnode.com';

export const metadata: Metadata = {
  title: 'Features API | SabNode',
  description: 'SabNode Features - Monochrome OpenAPI layout.',
  alternates: { canonical: `${SITE_URL}/features` },
};

export default function FeaturesIndexPage() {
  return (
    <div className="sn-root relative min-h-screen bg-white text-black font-mono selection:bg-black selection:text-white flex flex-col">
      <FeatureHeader />
      <FeaturesClient />
      <FeatureFooter />
    </div>
  );
}
