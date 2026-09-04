import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSubmissions, Submission } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

interface GroupedRow {
  date: string;
  person: string;
  account: string;
  plan: Submission | null;
  update: Submission | null;
}

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('pramaan_session_neuratantraai')?.value;
    const passcode = process.env.NEURATANTRAAI_PASSCODE || '';
    const session = await verifySession(cookie || '', passcode);

    if (!session || session.role !== 'neuratantraai') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const submissions = await getSubmissions();

    // Group submissions by date, person, account (including singletons)
    const groups: {
      [key: string]: {
        date: string;
        person: string;
        account: string;
        plan?: Submission;
        update?: Submission;
      };
    } = {};

    submissions.forEach((sub) => {
      const key = `${sub.date}|${sub.person}|${sub.account}`;
      if (!groups[key]) {
        groups[key] = { date: sub.date, person: sub.person, account: sub.account };
      }
      if (sub.entryType === 'Plan') {
        groups[key].plan = sub;
      } else if (sub.entryType === 'Update') {
        groups[key].update = sub;
      }
    });

    const groupedRows: GroupedRow[] = [];

    for (const key in groups) {
      const g = groups[key];
      groupedRows.push({
        date: g.date,
        person: g.person,
        account: g.account,
        plan: g.plan || null,
        update: g.update || null,
      });
    }

    // Filter by date range
    let filtered = groupedRows;
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= endDate);
    }

    // Sort descending by date
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ success: true, data: filtered });
  } catch (err: any) {
    console.error('API dashboard fetch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
