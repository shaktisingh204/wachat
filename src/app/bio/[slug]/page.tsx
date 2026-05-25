import { connectToDatabase } from '@/lib/mongodb';
import { BioProfile } from '@/lib/definitions';
import { Metadata } from 'next';
import { Instagram, Twitter, Linkedin, Github, Globe, Mail } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

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
        <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <Avatar className="h-20 w-20 ring-4 ring-zinc-800">
            <AvatarFallback className="bg-zinc-800 text-zinc-500 uppercase text-2xl font-bold">
              ?
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold text-white">Profile coming soon</h1>
            <p className="mt-1.5 text-sm text-zinc-500">@{slug}</p>
          </div>
          <Button asChild variant="outline" className="mt-4">
            <a href="/">Go Home</a>
          </Button>
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
            <Button 
              key={link.id} 
              asChild
              noMotion
              className="w-full h-14 rounded-xl font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: btnColor, color: btnText }}
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-16 pb-8 text-center opacity-40 hover:opacity-100 transition-opacity text-xs font-medium tracking-wide">
        <a href="/" className="flex items-center justify-center gap-2">
          <span>POWERED BY</span>
          <span className="font-bold">SABNODE</span>
        </a>
      </div>
    </div>
  );
}
