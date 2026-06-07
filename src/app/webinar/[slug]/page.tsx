import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Radio, Clock, User, PlayCircle } from 'lucide-react';
import { getSabwebinarBySlug } from '@/app/actions/sabwebinar.actions';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Alert,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function WebinarLandingPage({ params }: Params) {
  const { slug } = await params;
  const { data: webinar } = await getSabwebinarBySlug(slug);
  if (!webinar) notFound();

  const theme = webinar.landingTheme ?? {};
  // User-picked landing colors are genuinely runtime-computed, so inline style is allowed here.
  const bg = theme.backgroundColor ?? '#0b0d12';
  const fg = theme.textColor ?? '#ffffff';
  const accent = theme.accentColor ?? '#2563eb';
  const ctaLabel = theme.ctaLabel ?? 'Register';
  const headline = theme.headline ?? webinar.title;
  const subline = theme.subHeadline ?? webinar.description ?? null;

  return (
    <main className="ui20 min-h-screen" style={{ background: bg, color: fg }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageEyebrow style={{ color: fg, opacity: 0.7 }}>SabWebinar</PageEyebrow>
            <PageTitle className="text-4xl sm:text-6xl" style={{ color: fg }}>
              {headline}
            </PageTitle>
            {subline ? (
              <PageDescription className="text-lg" style={{ color: fg, opacity: 0.8 }}>
                {subline}
              </PageDescription>
            ) : null}
          </PageHeaderHeading>
        </PageHeader>

        {webinar.scheduledStart ? (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: fg, opacity: 0.7 }}
          >
            <Clock size={14} aria-hidden="true" />
            <span>
              {new Date(webinar.scheduledStart).toLocaleString()}{' '}
              {webinar.timezone ? `(${webinar.timezone})` : ''}
              {webinar.durationMinutes ? ` - ${webinar.durationMinutes} minutes` : ''}
            </span>
          </p>
        ) : null}

        <div>
          <Link href={`/webinar/${webinar.slug}/register`}>
            <Button variant="primary" size="lg" style={{ background: accent, color: '#ffffff' }}>
              {ctaLabel}
            </Button>
          </Link>
        </div>

        {theme.hostBio || webinar.hostName ? (
          <Card variant="outlined" padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={16} aria-hidden="true" />
                About your host
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              {webinar.hostName ? (
                <p className="font-medium text-[var(--st-text)]">{webinar.hostName}</p>
              ) : null}
              {theme.hostBio ? (
                <p className="text-[var(--st-text-secondary)]">{theme.hostBio}</p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {webinar.status === 'live' ? (
          <Alert tone="success" icon={Radio} title="We are live right now">
            <Link
              href={`/webinar/${webinar.slug}/register`}
              className="underline underline-offset-2"
            >
              Register and join
            </Link>
            .
          </Alert>
        ) : null}

        {webinar.status === 'ended' && webinar.recordingFileId ? (
          <Alert tone="info" icon={PlayCircle} title="This webinar has ended">
            <Link
              href={`/webinar/${webinar.slug}/replay`}
              className="underline underline-offset-2"
            >
              Watch the replay
            </Link>
            .
          </Alert>
        ) : null}
      </div>
    </main>
  );
}
