import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSubmissions } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const technohandsCookie = request.cookies.get('pramaan_session_technohands')?.value;
    const neuratantraaiCookie = request.cookies.get('pramaan_session_neuratantraai')?.value;

    const technohandsPasscode = process.env.TECHNOHANDS_PASSCODE || '';
    const neuratantraaiPasscode = process.env.NEURATANTRAAI_PASSCODE || '';

    const isTechnohands = technohandsCookie && (await verifySession(technohandsCookie, technohandsPasscode));
    const isNeuratantraai = neuratantraaiCookie && (await verifySession(neuratantraaiCookie, neuratantraaiPasscode));

    if (!isTechnohands && !isNeuratantraai) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const person = searchParams.get('person');
    const account = searchParams.get('account');
    const entryType = searchParams.get('entryType');

    let data = await getSubmissions();

    // Apply server-side filters if query params are present
    if (date) {
      data = data.filter((sub) => sub.date === date);
    }
    if (person) {
      data = data.filter((sub) => sub.person.toLowerCase() === person.toLowerCase());
    }
    if (account) {
      data = data.filter((sub) => sub.account.toLowerCase() === account.toLowerCase());
    }
    if (entryType) {
      data = data.filter((sub) => sub.entryType === entryType);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('API submissions fetch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch submissions' }, { status: 500 });
  }
}
