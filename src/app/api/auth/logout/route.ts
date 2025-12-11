
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    
    // Clear the session cookie by setting its expiration to a past date
    response.cookies.set({
        name: 'session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
