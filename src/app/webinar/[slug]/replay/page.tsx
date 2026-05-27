import { notFound } from 'next/navigation';
import { getSabwebinarBySlug } from '@/app/actions/sabwebinar.actions';

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
    <main style={{ background: bg, color: fg, minHeight: '100vh' }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{webinar.title}</h1>
          <p className="opacity-70">Replay · webinar ended.</p>
        </header>

        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          {webinar.recordingFileId ? (
            // TODO(integrator): swap to a SabFiles-resolved playback URL.
            <video
              controls
              playsInline
              className="h-full w-full"
              src={`/api/sabfiles/${webinar.recordingFileId}/stream`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm opacity-60">
              Recording not available yet.
            </div>
          )}
        </div>

        {webinar.description ? (
          <p className="opacity-80">{webinar.description}</p>
        ) : null}
      </div>
    </main>
  );
}
