import React from "react";
import { getSession } from '@/app/actions';
import HomePageClient from './page-client';

export const dynamic = 'force-dynamic';


async function HomePageContent() {
  const session = await getSession();

  return <HomePageClient initialSession={session} />;
}


export default function HomePage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <HomePageContent  />
    </React.Suspense>
  );
}
