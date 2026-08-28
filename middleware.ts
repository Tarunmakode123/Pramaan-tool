import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that require Technohands authorization
  if (pathname.startsWith('/technohands') && !pathname.startsWith('/technohands/login')) {
    const cookie = request.cookies.get('pramaan_session_technohands')?.value;
    const passcode = process.env.TECHNOHANDS_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'technohands') {
      const loginUrl = new URL('/technohands/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('pramaan_session_technohands');
      return response;
    }
  }

  // Paths that require Neuratantraai authorization
  if (pathname.startsWith('/neuratantraai') && !pathname.startsWith('/neuratantraai/login')) {
    const cookie = request.cookies.get('pramaan_session_neuratantraai')?.value;
    const passcode = process.env.NEURATANTRAAI_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'neuratantraai') {
      const loginUrl = new URL('/neuratantraai/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('pramaan_session_neuratantraai');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/technohands/:path*', '/neuratantraai/:path*'],
};
