import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { appendSubmission } from '@/lib/google-sheets';

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
      platform,
      postType,
      postCount,
      outreachCount,
      pollsPosted,
      groupsJoined,
      groupPostCount,
      engagementNotes,
      contentCreationNotes,
      rawText,
      parsedByAI
    } = body;

    // Validate required fields
    if (!date || !person || !account || !entryType) {
      return NextResponse.json({ error: 'Missing required fields: date, person, account, entryType' }, { status: 400 });
    }

    if (entryType !== 'Plan' && entryType !== 'Update') {
      return NextResponse.json({ error: 'Invalid entry type' }, { status: 400 });
    }

    // Append to Google Sheets
    const result = await appendSubmission({
      date,
      person,
      account,
      entryType,
      platform: platform || '',
      postType: postType || '',
      postCount: Number(postCount) || 0,
      outreachCount: Number(outreachCount) || 0,
      pollsPosted: Number(pollsPosted) || 0,
      groupsJoined: Number(groupsJoined) || 0,
      groupPostCount: Number(groupPostCount) || 0,
      engagementNotes: engagementNotes || '',
      contentCreationNotes: contentCreationNotes || '',
      rawText: rawText || '',
      parsedByAI: Boolean(parsedByAI),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('API submit error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit log to Google Sheet' }, { status: 500 });
  }
}
