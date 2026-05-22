import React from 'react';
import { getSocialPosts } from '@/app/actions/marketing/social-media-scheduler.actions';
import { SocialPostClient } from './_social-media-scheduler-client';

export default async function SocialPostPage() {
  const data = await getSocialPosts();
  
  return <SocialPostClient initialData={data} />;
}
