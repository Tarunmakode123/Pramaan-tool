import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { appendSubmission, ActivityItem } from '@/lib/google-sheets';
import { parseTextWithGemini } from '@/lib/gemini';

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
    } = body;

    // Validate required fields
    if (!date || !person || !account || !entryType || !rawText || !rawText.trim()) {
      return NextResponse.json({ error: 'Missing required fields: date, person, account, entryType, rawText' }, { status: 400 });
    }

    if (entryType !== 'Plan' && entryType !== 'Update') {
      return NextResponse.json({ error: 'Invalid entry type' }, { status: 400 });
    }

    let parsedByAI = false;
    let activityItems: ActivityItem[] = [];

    // Trigger Gemini extraction server-side
    try {
      activityItems = await parseTextWithGemini(rawText);
      parsedByAI = true;
    } catch (err) {
      console.error('Server-side Gemini extraction failed, creating fallback item:', err);
      // Fallback single item if AI parsing fails
      activityItems = [
        {
          activityType: 'General Work Log',
          platform: null,
          description: rawText.trim().slice(0, 80),
          count: null,
          isPostable: false,
          verifiedStatus: 'not_independently_verifiable',
        },
      ];
    }

    // Append to Google Sheets
    try {
      const result = await appendSubmission({
        date,
        person,
        account,
        entryType,
        rawText: rawText.trim(),
        parsedByAI,
        activityItems,
      });

      return NextResponse.json({ success: true, data: result });
    } catch (sheetsErr: any) {
      console.error('Google Sheets append error:', sheetsErr);
      const msg = sheetsErr.message || String(sheetsErr);
      if (msg.includes('Requested entity was not found')) {
        return NextResponse.json({
          error: 'Google Sheets Error: Spreadsheet ID not found or missing permissions. Please verify GOOGLE_SHEET_ID in Vercel environment variables and ensure the Google Sheet is shared with pramaan-db@principal-iris-471514-v6.iam.gserviceaccount.com as Editor.'
        }, { status: 404 });
      }
      return NextResponse.json({
        error: `Google Sheets Error: ${msg}`
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('API submit error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit log to Google Sheet' }, { status: 500 });
  }
}
