import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { updateSubmissionItemVerification } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pramaan_session_neuratantraai')?.value;
    const passcode = process.env.NEURATANTRAAI_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'neuratantraai') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      person,
      account,
      entryType,
      itemIndex,
      verifiedStatus,
    } = body;

    if (
      !date ||
      !person ||
      !account ||
      !entryType ||
      itemIndex === undefined ||
      itemIndex === null ||
      !verifiedStatus
    ) {
      return NextResponse.json({ error: 'Missing required verification parameters.' }, { status: 400 });
    }

    if (!['unreviewed', 'verified', 'disputed', 'not_independently_verifiable'].includes(verifiedStatus)) {
      return NextResponse.json({ error: 'Invalid verified status.' }, { status: 400 });
    }

    const success = await updateSubmissionItemVerification({
      date,
      person,
      account,
      entryType,
      itemIndex: Number(itemIndex),
      verifiedStatus,
      verifiedBy: 'NeuraTantraAI Reviewer',
    });

    if (!success) {
      return NextResponse.json({ error: 'Submission item not found or failed to update.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API verify-item error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update item verification' }, { status: 500 });
  }
}
