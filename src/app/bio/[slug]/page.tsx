import { connectToDatabase } from '@/lib/mongodb';
import { BioProfile } from '@/lib/definitions';
import { Metadata } from 'next';
import Link from 'next/link';
import { Instagram, Twitter, Linkedin, Github, Globe, Mail } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { db } = await connectToDatabase();
  const profile = await db.collection('bio_profiles').findOne({ slug }) as BioProfile | null;
  if (!profile) return { title: `@${slug} | Not Found` };
  return { title: `${profile.displayName} (@${slug})`, description: profile.bio };
}

export async function generateStaticParams() {
  try {
    const { db } = await connectToDatabase();
    const profiles = await db.collection('bio_profiles')
      .find({}, { projection: { slug: 1 } })
      .limit(100)
      .toArray();

    return profiles.map((p) => ({
      slug: p.slug,
    }));
  } catch (error) {
    console.error('Error fetching static params for bio profiles:', error);
    return [];
  }
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'instagram') return <Instagram className="w-5 h-5" aria-hidden="true" />;
  if (p === 'twitter' || p === 'x') return <Twitter className="w-5 h-5" aria-hidden="true" />;
  if (p === 'linkedin') return <Linkedin className="w-5 h-5" aria-hidden="true" />;
  if (p === 'github') return <Github className="w-5 h-5" aria-hidden="true" />;
  if (p === 'website') return <Globe className="w-5 h-5" aria-hidden="true" />;
  if (p === 'email') return <Mail className="w-5 h-5" aria-hidden="true" />;
  return <Globe className="w-5 h-5" aria-hidden="true" />;
}

export default async function BioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db } = await connectToDatabase();
  const profile = await db.collection('bio_profiles').findOne({ slug }) as BioProfile | null;

  if (!profile) {
    return (
      <div className="20ui flex min-h-screen flex-col items-center justify-center bg-[var(--st-bg)] px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
          <Avatar className="h-20 w-20 ring-4 ring-[var(--st-border)]">
            <AvatarFallback className="bg-[var(--st-bg-tertiary)] text-[var(--st-text-secondary)] uppercase text-2xl font-bold">
              ?
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-[var(--st-text)]">Profile coming soon</h1>
            <p className="mt-1.5 text-sm text-[var(--st-text-secondary)]">@{slug}</p>
          </div>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-[var(--st-radius)] border border-[var(--st-border)] text-sm font-medium text-[var(--st-text)] bg-[var(--st-bg)] transition-colors hover:bg-[var(--st-bg-secondary)]"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const { theme, links, socials } = profile;
  const bgColor = theme?.backgroundColor || '#09090b';
  const textColor = theme?.textColor || '#ffffff';
  const btnColor = theme?.buttonColor || '#27272a';
  const btnText = theme?.buttonTextColor || '#ffffff';

  return (
    <div className="20ui flex min-h-screen flex-col items-center py-16 px-4" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <Avatar className="h-24 w-24 ring-4 ring-black/10 shadow-xl overflow-hidden">
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} className="object-cover" />
          ) : null}
          <AvatarFallback
            className="text-3xl font-bold uppercase"
            style={{ backgroundColor: btnColor, color: btnText }}
          >
            {profile.displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          {profile.bio && (
            <p className="mt-2 text-sm opacity-80 max-w-sm mx-auto">{profile.bio}</p>
          )}
        </div>

        {socials && socials.length > 0 && (
          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            {socials.map((social, i) => (
              <a
                key={i}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 hover:scale-110 active:scale-95 transition-all"
                aria-label={social.platform}
              >
                <SocialIcon platform={social.platform} />
              </a>
            ))}
          </div>
        )}

        <div className="w-full flex flex-col gap-3 mt-4">
          {links && links.filter(l => l.active).map(link => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-14 rounded-xl font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: btnColor, color: btnText }}
            >
              {link.title}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-16 pb-8 text-center opacity-40 hover:opacity-100 transition-opacity text-xs font-medium tracking-wide">
        <Link href="/" className="flex items-center justify-center gap-2">
          <span>POWERED BY</span>
          <span className="font-bold">SABNODE</span>
        </Link>
      </div>
    </div>
  );
}
