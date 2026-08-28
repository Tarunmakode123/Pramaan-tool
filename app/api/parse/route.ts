import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { parseTextWithGemini } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pramaan_session_technohands')?.value;
    const passcode = process.env.TECHNOHANDS_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'technohands') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rawText } = await request.json();
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'Missing or empty rawText parameter' }, { status: 400 });
    }

    const parsed = await parseTextWithGemini(rawText);
    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('API parse error:', err);
    return NextResponse.json({ error: err.message || 'Failed to parse text with AI' }, { status: 500 });
  }
}
