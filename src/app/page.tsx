
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions';

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <WachatLogo className="w-48 h-auto" />
        </div>
        <h1 className="text-4xl font-bold font-headline mb-4">Welcome to Wachat</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Streamline Your WhatsApp Business API Experience.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
