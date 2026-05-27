import { notFound } from 'next/navigation';
import {
  getSabwebinar,
  getSabwebinarAnalytics,
  listSabwebinarPolls,
  listSabwebinarQna,
  listSabwebinarRegistrations,
} from '@/app/actions/sabwebinar.actions';
import { SabwebinarDetailClient } from './_components/sabwebinar-detail-client';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ webinarId: string }>;
}

export default async function SabwebinarDetailPage({ params }: Params) {
  const { webinarId } = await params;

  // Independent reads — parallelize per react-best-practices `async-parallel`.
  const [webinar, registrations, polls, qna, analytics] = await Promise.all([
    getSabwebinar(webinarId),
    listSabwebinarRegistrations(webinarId),
    listSabwebinarPolls(webinarId),
    listSabwebinarQna(webinarId),
    getSabwebinarAnalytics(webinarId),
  ]);

  if (!webinar.data) notFound();

  return (
    <SabwebinarDetailClient
      webinar={webinar.data}
      registrations={registrations.data}
      polls={polls.data}
      qna={qna.data}
      analytics={analytics.data}
    />
  );
}
