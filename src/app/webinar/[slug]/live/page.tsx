import { notFound } from 'next/navigation';
import {
  getSabwebinarBySlug,
  listSabwebinarPolls,
  listSabwebinarQna,
} from '@/app/actions/sabwebinar.actions';
import { LiveAttendeeView } from './live-attendee-view';

export const dynamic = 'force-dynamic';

interface PageArgs {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function WebinarLivePage({ params, searchParams }: PageArgs) {
  const [{ slug }, { t }] = await Promise.all([params, searchParams]);
  const { data: webinar } = await getSabwebinarBySlug(slug);
  if (!webinar) notFound();

  const [polls, qna] = await Promise.all([
    listSabwebinarPolls(webinar._id),
    listSabwebinarQna(webinar._id),
  ]);

  return (
    <LiveAttendeeView
      webinarId={webinar._id}
      slug={webinar.slug}
      title={webinar.title}
      theme={webinar.landingTheme}
      status={webinar.status}
      joinToken={t}
      initialPolls={polls.data}
      initialQna={qna.data}
    />
  );
}
