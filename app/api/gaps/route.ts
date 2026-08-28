import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSubmissions, Submission } from '@/lib/google-sheets';
import { generateGapSummary } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

interface PairedRow {
  date: string;
  person: string;
  account: string;
  plan: Submission | null;
  update: Submission | null;
  hasGap: boolean;
  gapSummary: string;
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

    // 1. Group submissions by date, person, account
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

    // 2. Convert to paired rows
    const pairedRows: PairedRow[] = [];

    for (const key in groups) {
      const g = groups[key];
      const plan = g.plan || null;
      const update = g.update || null;

      let hasGap = false;
      let gapSummary = '';

      if (plan && update) {
        // Compare metrics
        const postCountGap = update.postCount < plan.postCount;
        const outreachGap = update.outreachCount < plan.outreachCount;
        const pollsGap = update.pollsPosted < plan.pollsPosted;
        const groupsJoinedGap = update.groupsJoined < plan.groupsJoined;
        const groupPostGap = update.groupPostCount < plan.groupPostCount;

        if (
          postCountGap ||
          outreachGap ||
          pollsGap ||
          groupsJoinedGap ||
          groupPostGap
        ) {
          hasGap = true;
        }
      } else if (plan && !update) {
        hasGap = true;
        gapSummary = 'No update submitted for the plan.';
      } else if (!plan && update) {
        gapSummary = 'No plan submitted for the update.';
      }

      pairedRows.push({
        date: g.date,
        person: g.person,
        account: g.account,
        plan,
        update,
        hasGap,
        gapSummary,
      });
    }

    // 3. Filter by date range
    let filtered = pairedRows;
    if (startDate) {
      filtered = filtered.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((r) => r.date <= endDate);
    }

    // 4. Generate Gemini gap summaries in parallel for the filtered list
    await Promise.all(
      filtered.map(async (row) => {
        if (row.hasGap && !row.gapSummary && row.plan && row.update) {
          row.gapSummary = await generateGapSummary(row.plan, row.update);
        }
      })
    );

    // Sort by date descending
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ success: true, data: filtered });
  } catch (err: any) {
    console.error('API gaps fetch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch dashboard gaps' }, { status: 500 });
  }
}
