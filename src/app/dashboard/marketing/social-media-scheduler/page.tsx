import React, { Suspense } from 'react';
import { getSocialPosts } from '@/app/actions/marketing/social-media-scheduler.actions';
import { SocialPostClient } from './_social-media-scheduler-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

async function SocialPostsData() {
  const data = await getSocialPosts();
  
  if (!data || !Array.isArray(data)) {
    throw new Error("Failed to load social media posts data.");
  }
  
  return <SocialPostClient initialData={data} />;
}

export default function SocialPostPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SocialPostsData />
    </Suspense>
  );
}
