import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json().catch(() => ({ role: null }));
    const response = NextResponse.json({ success: true });

    if (role === 'technohands' || !role) {
      response.cookies.set({
        name: 'pramaan_session_technohands',
        value: '',
        maxAge: 0,
        expires: new Date(0),
        path: '/',
      });
    }
    if (role === 'neuratantraai' || !role) {
      response.cookies.set({
        name: 'pramaan_session_neuratantraai',
        value: '',
        maxAge: 0,
        expires: new Date(0),
        path: '/',
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
