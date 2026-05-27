import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSabwebinarBySlug } from '@/app/actions/sabwebinar.actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function WebinarLandingPage({ params }: Params) {
  const { slug } = await params;
  const { data: webinar } = await getSabwebinarBySlug(slug);
  if (!webinar) notFound();

  const theme = webinar.landingTheme ?? {};
  const bg = theme.backgroundColor ?? '#0b0d12';
  const fg = theme.textColor ?? '#ffffff';
  const accent = theme.accentColor ?? '#2563eb';
  const ctaLabel = theme.ctaLabel ?? 'Register';
  const headline = theme.headline ?? webinar.title;

  return (
    <main style={{ background: bg, color: fg, minHeight: '100vh' }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <p className="text-sm uppercase tracking-widest opacity-70">SabWebinar</p>
          <h1 className="text-4xl font-bold sm:text-6xl" style={{ color: fg }}>
            {headline}
          </h1>
          {theme.subHeadline ? (
            <p className="text-lg opacity-80">{theme.subHeadline}</p>
          ) : webinar.description ? (
            <p className="text-lg opacity-80">{webinar.description}</p>
          ) : null}
          {webinar.scheduledStart ? (
            <p className="text-sm opacity-70">
              {new Date(webinar.scheduledStart).toLocaleString()}{' '}
              {webinar.timezone ? `(${webinar.timezone})` : ''}
              {webinar.durationMinutes ? ` · ${webinar.durationMinutes} minutes` : ''}
            </p>
          ) : null}
        </header>

        <div>
          <Link
            href={`/webinar/${webinar.slug}/register`}
            className="inline-block rounded-md px-6 py-3 font-medium"
            style={{ background: accent, color: '#ffffff' }}
          >
            {ctaLabel}
          </Link>
        </div>

        {theme.hostBio || webinar.hostName ? (
          <section className="flex flex-col gap-2 rounded-lg border border-white/10 p-6">
            <h2 className="text-xl font-semibold">About your host</h2>
            {webinar.hostName ? <p className="font-medium">{webinar.hostName}</p> : null}
            {theme.hostBio ? <p className="opacity-80">{theme.hostBio}</p> : null}
          </section>
        ) : null}

        {webinar.status === 'live' ? (
          <div className="rounded-md border border-white/20 p-4">
            <p className="text-sm">
              We are live right now —{' '}
              <Link href={`/webinar/${webinar.slug}/register`} className="underline">
                register and join
              </Link>
              .
            </p>
          </div>
        ) : null}

        {webinar.status === 'ended' && webinar.recordingFileId ? (
          <div className="rounded-md border border-white/20 p-4">
            <p className="text-sm">
              This webinar has ended.{' '}
              <Link href={`/webinar/${webinar.slug}/replay`} className="underline">
                Watch the replay
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
