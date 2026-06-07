import { notFound } from 'next/navigation';
import { VideoOff } from 'lucide-react';
import { getSabwebinarBySlug } from '@/app/actions/sabwebinar.actions';
import {
  Card,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

/**
 * Post-event replay page. The recording is stored as a SabFiles file id;
 * we resolve a playable URL via the project-wide SabFiles helper.
 *
 * TODO(integrator): resolve `recordingFileId` -> public URL via the
 * SabFiles helper exported by the files module instead of the stub path
 * below.
 */
interface RouteArgs {
  params: Promise<{ slug: string }>;
}

export default async function WebinarReplayPage({ params }: RouteArgs) {
  const { slug } = await params;
  const { data: webinar } = await getSabwebinarBySlug(slug);
  if (!webinar) notFound();

  const theme = webinar.landingTheme ?? {};
  const bg = theme.backgroundColor ?? '#0b0d12';
  const fg = theme.textColor ?? '#ffffff';

  return (
    <main className="ui20 min-h-screen" style={{ background: bg, color: fg }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageTitle>{webinar.title}</PageTitle>
            <PageDescription>Replay, webinar ended.</PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        <Card padding="none" className="overflow-hidden">
          <div className="aspect-video w-full bg-black">
            {webinar.recordingFileId ? (
              // TODO(integrator): swap to a SabFiles-resolved playback URL.
              <video
                controls
                playsInline
                className="h-full w-full"
                src={`/api/sabfiles/${webinar.recordingFileId}/stream`}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  icon={VideoOff}
                  title="Recording not available yet"
                  description="The replay will appear here once the recording has finished processing."
                />
              </div>
            )}
          </div>
        </Card>

        {webinar.description ? (
          <p className="text-[var(--st-text-secondary)]">{webinar.description}</p>
        ) : null}
      </div>
    </main>
  );
}
