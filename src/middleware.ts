
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { connectToDatabase } from './lib/mongodb'
import { type ShortUrl } from './lib/definitions'

async function handleCustomDomainRedirect(request: NextRequest) {
    const host = request.headers.get('host')!
    const shortCode = request.nextUrl.pathname.substring(1)

    // Ignore requests for static assets or API routes on the custom domain
    if (!shortCode || shortCode.startsWith('_next') || shortCode.startsWith('api/')) {
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        // This is a potentially slow query. In a production system with many users,
        // it would be better to have a dedicated collection for domains to query against.
        const userWithDomain = await db.collection('users').findOne({ 'customDomains.hostname': host, 'customDomains.verified': true });

        if (userWithDomain) {
            const domain = userWithDomain.customDomains.find((d: any) => d.hostname === host);
            if (domain) {
                const urlDoc = await db.collection<ShortUrl>('short_urls').findOne({
                    shortCode,
                    domainId: domain._id.toString()
                });

                if (urlDoc) {
                    // Check for expiration
                    if (urlDoc.expiresAt && new Date() > new Date(urlDoc.expiresAt)) {
                        return new NextResponse('This link has expired.', { status: 410 });
                    }
                    // Fire-and-forget click tracking. Full analytics are still done on the /s/:shortCode page.
                    db.collection('short_urls').updateOne({ _id: urlDoc._id }, { $inc: { clickCount: 1 } });
                    return NextResponse.redirect(new URL(urlDoc.originalUrl));
                }
            }
        }
    } catch (e) {
        console.error("Custom domain redirect error:", e);
    }

    return null; // Fall through if no redirect found
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';

  // Determine the app's base hostname from environment variables
  const mainAppHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null;

  // If a main host is configured and the request host is different, treat it as a custom domain.
  if (mainAppHost && host !== mainAppHost && !host.startsWith('localhost')) {
      const redirectResponse = await handleCustomDomainRedirect(request);
      if (redirectResponse) return redirectResponse;
      // If no redirect is found, show a 404.
      return new NextResponse(`Not Found: No short URL for this path on domain ${host}`, { status: 404 });
  }

  // Authentication logic for the main application
  const sessionToken = request.cookies.get('session')?.value
  const adminSessionToken = request.cookies.get('admin_session')?.value

  // If trying to access a protected dashboard route without the correct session, redirect to the appropriate login page.
  if (pathname.startsWith('/admin/dashboard') && !adminSessionToken) {
    return NextResponse.redirect(new URL('/admin-login', request.url));
  }
  if (pathname.startsWith('/dashboard') && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If already logged in, redirect away from the login/signup pages.
  if (sessionToken && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (adminSessionToken && pathname === '/admin-login') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // Allow the request to proceed if none of the above conditions are met.
  return NextResponse.next();
}

// Matcher should catch everything except for API routes, static files, and image optimization.
// The default short link path /s/ is also excluded so it can be handled by its dedicated page file.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|s/|.*\\..*).*)',
  ],
}
