import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { appendSubmission, ActivityItem } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pramaan_session_technohands')?.value;
    const passcode = process.env.TECHNOHANDS_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'technohands') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      person,
      account,
      entryType,
      rawText,
      parsedByAI,
      activityItems
    } = body;

    // Validate required fields
    if (!date || !person || !account || !entryType) {
      return NextResponse.json({ error: 'Missing required fields: date, person, account, entryType' }, { status: 400 });
    }

    if (entryType !== 'Plan' && entryType !== 'Update') {
      return NextResponse.json({ error: 'Invalid entry type' }, { status: 400 });
    }

    if (!Array.isArray(activityItems)) {
      return NextResponse.json({ error: 'activityItems must be a valid array' }, { status: 400 });
    }

    // Clean activity items
    const cleanedItems: ActivityItem[] = activityItems.map((item: any) => ({
      activityType: String(item.activityType || '').trim(),
      platform: item.platform ? String(item.platform).trim() : null,
      description: String(item.description || '').trim(),
      count: item.count !== undefined && item.count !== null ? Number(item.count) : null,
    }));

    // Append to Google Sheets
    const result = await appendSubmission({
      date,
      person,
      account,
      entryType,
      rawText: rawText || `Submitted manually by ${person}`,
      parsedByAI: Boolean(parsedByAI),
      activityItems: cleanedItems,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('API submit error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit log to Google Sheet' }, { status: 500 });
  }
}
