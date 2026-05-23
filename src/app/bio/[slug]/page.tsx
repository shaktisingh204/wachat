import { connectToDatabase } from '@/lib/mongodb';
import { BioProfile } from '@/lib/definitions';
import { Metadata } from 'next';
import { Instagram, Twitter, Linkedin, Github, Globe, Mail } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { db } = await connectToDatabase();
  const profile = await db.collection('bio_profiles').findOne({ slug }) as BioProfile | null;
  if (!profile) return { title: `@${slug} | Not Found` };
  return { title: `${profile.displayName} (@${slug})`, description: profile.bio };
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'instagram') return <Instagram className="w-5 h-5" />;
  if (p === 'twitter' || p === 'x') return <Twitter className="w-5 h-5" />;
  if (p === 'linkedin') return <Linkedin className="w-5 h-5" />;
  if (p === 'github') return <Github className="w-5 h-5" />;
  if (p === 'website') return <Globe className="w-5 h-5" />;
  if (p === 'email') return <Mail className="w-5 h-5" />;
  return <Globe className="w-5 h-5" />;
}

export default async function BioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db } = await connectToDatabase();
  const profile = await db.collection('bio_profiles').findOne({ slug }) as BioProfile | null;

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-20 w-20 rounded-full bg-zinc-800" />
          <div>
            <h1 className="text-xl font-semibold text-white">This page is coming soon</h1>
            <p className="mt-1.5 text-sm text-zinc-500">@{slug}</p>
          </div>
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
    <div className="flex min-h-screen flex-col items-center py-16 px-4" style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={profile.displayName} className="h-24 w-24 rounded-full object-cover shadow-lg" />
        ) : (
          <div className="h-24 w-24 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold uppercase text-white shadow-lg">
            {profile.displayName.charAt(0)}
          </div>
        )}
        
        <div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          <p className="mt-2 text-sm opacity-80 max-w-sm mx-auto">{profile.bio}</p>
        </div>

        {socials && socials.length > 0 && (
          <div className="flex gap-4 mt-2">
            {socials.map((social, i) => (
              <a key={i} href={social.url} target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity" aria-label={social.platform}>
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
              className="w-full py-4 px-6 rounded-xl font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center relative"
              style={{ backgroundColor: btnColor, color: btnText }}
            >
              {link.title}
            </a>
          ))}
        </div>
      </div>

      <div className="fixed bottom-8 text-center opacity-50 text-xs">
        <a href="/" className="hover:underline transition-all">
          Powered by SabNode
        </a>
      </div>
    </div>
  );
}
