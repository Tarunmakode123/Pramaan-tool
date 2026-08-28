import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSubmissions, Submission, ActivityItem } from '@/lib/google-sheets';
import { generateGapSummary, ActivityMismatch } from '@/lib/gemini';

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

    // 2. Convert to grouped rows and calculate gaps
    const pairedRows: (PairedRow & { mismatches: ActivityMismatch[] })[] = [];

    for (const key in groups) {
      const g = groups[key];
      const plan = g.plan || null;
      const update = g.update || null;

      let hasGap = false;
      let gapSummary = '';
      const mismatches: ActivityMismatch[] = [];

      if (plan && update) {
        // Find mismatches rule-based
        const planItems = plan.activityItems || [];
        const updateItems = update.activityItems || [];

        // For each item in Plan, check if there is a matching item in Update
        planItems.forEach((pItem) => {
          const pType = pItem.activityType.toLowerCase().trim();
          const pPlat = (pItem.platform || '').toLowerCase().trim();

          const match = updateItems.find((uItem) => {
            const uType = uItem.activityType.toLowerCase().trim();
            const uPlat = (uItem.platform || '').toLowerCase().trim();
            return uType === pType && uPlat === pPlat;
          });

          if (!match) {
            // Gap: Plan item not reported in Update
            hasGap = true;
            mismatches.push({ plan: pItem, type: 'missing' });
          } else if (
            pItem.count !== null &&
            match.count !== null &&
            match.count < pItem.count
          ) {
            // Variance: reported count is less than planned
            hasGap = true;
            mismatches.push({ plan: pItem, update: match, type: 'variance' });
          }
        });
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
        mismatches,
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
        if (row.hasGap && !row.gapSummary && row.mismatches.length > 0) {
          row.gapSummary = await generateGapSummary(row.mismatches);
        }
      })
    );

    // Sort by date descending
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    // Strip out the internal mismatches before sending to client
    const clientData = filtered.map(({ mismatches, ...rest }) => rest);

    return NextResponse.json({ success: true, data: clientData });
  } catch (err: any) {
    console.error('API dashboard fetch error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
