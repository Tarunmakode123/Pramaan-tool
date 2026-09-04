import { NextRequest, NextResponse } from 'next/server';
import { signSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { passcode, role } = await request.json();

    if (!role || (role !== 'technohands' && role !== 'neuratantraai')) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    let envPasscode = (role === 'technohands'
      ? process.env.TECHNOHANDS_PASSCODE
      : process.env.NEURATANTRAAI_PASSCODE) || '';
    
    envPasscode = envPasscode.trim().replace(/^["']|["']$/g, '');
    const userPasscode = (passcode || '').trim();

    if (!envPasscode) {
      return NextResponse.json({ error: 'Server authentication passcode is not configured' }, { status: 500 });
    }

    if (userPasscode !== envPasscode) {
      return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
    }

    const token = await signSession({ role, timestamp: Date.now() }, envPasscode);
    const cookieName = `pramaan_session_${role}`;

    const response = NextResponse.json({ success: true, redirectUrl: `/${role}` });
    
    response.cookies.set({
      name: cookieName,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
