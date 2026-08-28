'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/app/components/Header';
import { Download, AlertTriangle, CheckCircle, HelpCircle, Calendar, User, Filter, RefreshCw, BarChart2 } from 'lucide-react';

interface Submission {
  timestamp: string;
  date: string;
  person: string;
  account: string;
  entryType: 'Plan' | 'Update';
  platform: string;
  postType: string;
  postCount: number;
  outreachCount: number;
  pollsPosted: number;
  groupsJoined: number;
  groupPostCount: number;
  engagementNotes: string;
  contentCreationNotes: string;
  rawText: string;
  parsedByAI: boolean;
}

interface PairedRow {
  date: string;
  person: string;
  account: string;
  plan: Submission | null;
  update: Submission | null;
  hasGap: boolean;
  gapSummary: string;
}

export default function OversightDashboard() {
  const getPastDateString = (daysAgo: number) => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localTime = new Date(Date.now() - tzoffset - daysAgo * 24 * 60 * 60 * 1000);
    return localTime.toISOString().slice(0, 10);
  };

  const getTodayString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzoffset).toISOString().slice(0, 10);
  };

  // State filters (default past 14 days to keep overview dashboard compact and fast)
  const [filterStartDate, setFilterStartDate] = useState(getPastDateString(14));
  const [filterEndDate, setFilterEndDate] = useState(getTodayString());
  const [filterPerson, setFilterPerson] = useState('All');
  const [filterAccount, setFilterAccount] = useState('All');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairedData, setPairedData] = useState<PairedRow[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Build API request query string
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/gaps?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPairedData(data.data);
      } else {
        setError(data.error || 'Failed to load dashboard data.');
      }
    } catch (err) {
      setError('Network error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Extract unique people from data for the dropdown filter list
  const uniquePeople = useMemo(() => {
    const people = new Set<string>(['Yogesh', 'Yogita']);
    pairedData.forEach((row) => {
      if (row.person) people.add(row.person);
    });
    return Array.from(people);
  }, [pairedData]);

  // Filter client-side based on dropdowns (Person, Account)
  const filteredRows = useMemo(() => {
    let result = [...pairedData];
    if (filterPerson !== 'All') {
      result = result.filter((row) => row.person === filterPerson);
    }
    if (filterAccount !== 'All') {
      result = result.filter((row) => row.account === filterAccount);
    }
    return result;
  }, [pairedData, filterPerson, filterAccount]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const gaps = filteredRows.filter((row) => row.hasGap).length;
    
    // Compliance check: both plan & update submitted
    const complete = filteredRows.filter((row) => row.plan && row.update).length;
    const complianceRate = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { total, gaps, complianceRate };
  }, [filteredRows]);

  // Streak Grid Calculations (Submission Consistency grid per person)
  const consistencyData = useMemo(() => {
    if (!filterStartDate || !filterEndDate) return { dates: [], grid: {} };

    // Get all dates in range
    const datesList: string[] = [];
    const current = new Date(filterStartDate);
    const end = new Date(filterEndDate);
    while (current <= end) {
      datesList.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    datesList.reverse(); // show latest first

    // Group submissions by person and date
    const grid: { [person: string]: { [date: string]: { plan: boolean; update: boolean } } } = {};
    
    // Initialize for all known people
    const peopleList = filterPerson === 'All' ? uniquePeople : [filterPerson];
    peopleList.forEach((person) => {
      grid[person] = {};
      datesList.forEach((date) => {
        grid[person][date] = { plan: false, update: false };
      });
    });

    // Populate actual logs
    pairedData.forEach((row) => {
      const person = row.person;
      const date = row.date;
      if (grid[person] && grid[person][date]) {
        grid[person][date].plan = !!row.plan;
        grid[person][date].update = !!row.update;
      }
    });

    return { dates: datesList, grid };
  }, [pairedData, filterStartDate, filterEndDate, filterPerson, uniquePeople]);

  // CSV Export Action
  const handleExport = () => {
    const headers = [
      'Date',
      'Person',
      'Account',
      'Plan Platform',
      'Update Platform',
      'Plan Post Count',
      'Update Post Count',
      'Plan Outreach',
      'Update Outreach',
      'Plan Polls',
      'Update Polls',
      'Plan Groups Joined',
      'Update Groups Joined',
      'Plan Group Posts',
      'Update Group Posts',
      'Gap Flagged',
      'AI Gap Summary',
      'Plan Notes',
      'Update Notes',
      'Raw Paste Log',
    ];

    const rows = filteredRows.map((row) => [
      row.date,
      row.person,
      row.account,
      row.plan?.platform || '',
      row.update?.platform || '',
      row.plan?.postCount ?? 0,
      row.update?.postCount ?? 0,
      row.plan?.outreachCount ?? 0,
      row.update?.outreachCount ?? 0,
      row.plan?.pollsPosted ?? 0,
      row.update?.pollsPosted ?? 0,
      row.plan?.groupsJoined ?? 0,
      row.update?.groupsJoined ?? 0,
      row.plan?.groupPostCount ?? 0,
      row.update?.groupPostCount ?? 0,
      row.hasGap ? 'TRUE' : 'FALSE',
      row.gapSummary || '',
      row.plan?.contentCreationNotes || '',
      row.update?.engagementNotes || '',
      row.update?.rawText || row.plan?.rawText || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pramaan_Oversight_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Header title="Pramaan" subtitle="प्रमाण" role="neuratantraai" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPI Panel */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Submissions (Pairs)</span>
              <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{stats.total}</h3>
            </div>
            <div className="rounded bg-brand-accent p-2.5 text-brand-primary">
              <BarChart2 size={24} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Gaps Flagged</span>
              <h3 className={`text-3xl font-extrabold mt-1 ${stats.gaps > 0 ? 'text-orange-600' : 'text-stone-900'}`}>
                {stats.gaps}
              </h3>
            </div>
            <div className={`rounded p-2.5 ${stats.gaps > 0 ? 'bg-orange-100 text-orange-600' : 'bg-stone-100 text-stone-400'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Compliance Streak</span>
              <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{stats.complianceRate}%</h3>
            </div>
            <div className="rounded bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
            <Filter className="text-brand-primary" size={18} />
            <h2 className="text-md font-bold text-stone-800">Oversight Filters</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Date Range Start</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Date Range End</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Filter Person</label>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="All">All Submitters</option>
                {uniquePeople.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Filter Account</label>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="All">All Client Accounts</option>
                <option value="Neuratantra">Neuratantra</option>
                <option value="AI by Vaibhav Jain">AI by Vaibhav Jain</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submission Consistency View (Streak Indicator Grid) */}
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-stone-800">Submission Consistency Matrix</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Overview of Plan and Update submission streaks. Red dots indicate missed submissions.
          </p>

          <div className="mt-6 space-y-4">
            {Object.keys(consistencyData.grid).length === 0 ? (
              <p className="text-sm text-stone-400">Select a valid date range to view compliance matrix.</p>
            ) : (
              Object.entries(consistencyData.grid).map(([person, dateMap]) => (
                <div key={person} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-3 last:border-0">
                  <span className="text-sm font-semibold text-stone-700 w-32 shrink-0">{person}</span>
                  <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0 items-center">
                    {consistencyData.dates.map((date) => {
                      const status = dateMap[date] || { plan: false, update: false };
                      let badgeColor = 'bg-stone-100 text-stone-400';
                      let label = 'Missed';
                      
                      if (status.plan && status.update) {
                        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        label = 'Plan & Update';
                      } else if (status.plan && !status.update) {
                        badgeColor = 'bg-orange-100 text-orange-800 border-orange-200';
                        label = 'Plan Only';
                      } else if (!status.plan && status.update) {
                        badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        label = 'Update Only';
                      }

                      return (
                        <div
                          key={date}
                          title={`${person} on ${date}: ${label}`}
                          className={`group relative flex h-7 w-7 items-center justify-center rounded-md border text-[9px] font-bold cursor-help transition-all ${badgeColor}`}
                        >
                          {status.plan && status.update ? '✓' : status.plan ? 'P' : status.update ? 'U' : '✗'}
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded bg-stone-900 px-2 py-1 text-[10px] text-white whitespace-nowrap group-hover:block">
                            {date}: {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Oversight Table */}
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-stone-800">Oversight Records & AI Gaps</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Detailed side-by-side comparison of planned vs. actual numbers with automated gap analysis.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className="flex items-center gap-1.5 rounded border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-all"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                disabled={filteredRows.length === 0}
                className="flex items-center gap-1.5 rounded bg-brand-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-all"
              >
                <Download size={12} />
                Export CSV
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded bg-red-50 p-3.5 text-sm font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            {loading ? (
              <p className="text-center py-6 text-sm text-stone-400">Analyzing logs & fetching Gemini gap summaries...</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-center py-6 text-sm text-stone-400">No submissions found in selected date range.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50/50">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 font-semibold">Details</th>
                    <th className="py-3 px-4 text-center bg-stone-100/30">Plan</th>
                    <th className="py-3 px-4 text-center bg-brand-accent/20">Update</th>
                    <th className="py-3 px-4">AI Gap Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {filteredRows.map((row) => {
                    const key = `${row.date}-${row.person}-${row.account}`;
                    return (
                      <tr
                        key={key}
                        className={`hover:bg-stone-50/50 transition-all ${
                          row.hasGap ? 'bg-orange-50/30 hover:bg-orange-50/50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-semibold text-stone-700 whitespace-nowrap align-top">
                          {row.date}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-stone-600 align-top">
                          <div className="font-bold text-stone-800">{row.person}</div>
                          <div className="mt-0.5 font-medium text-stone-400">{row.account}</div>
                        </td>
                        {/* Plan column */}
                        <td className="py-3.5 px-4 bg-stone-100/10 text-xs text-stone-600 align-top">
                          {row.plan ? (
                            <div className="space-y-1">
                              <div>
                                <span className="font-semibold text-stone-700">Posts:</span> {row.plan.postCount}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-700">Outreach:</span> {row.plan.outreachCount}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-700">Groups:</span> {row.plan.groupsJoined}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-700">Group Posts:</span> {row.plan.groupPostCount}
                              </div>
                            </div>
                          ) : (
                            <span className="italic text-stone-400">No plan submitted</span>
                          )}
                        </td>
                        {/* Update column */}
                        <td className="py-3.5 px-4 bg-brand-accent/5 text-xs text-stone-700 align-top">
                          {row.update ? (
                            <div className="space-y-1">
                              <div>
                                <span className="font-semibold text-stone-800">Posts:</span> {row.update.postCount}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-800">Outreach:</span> {row.update.outreachCount}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-800">Groups:</span> {row.update.groupsJoined}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-800">Group Posts:</span> {row.update.groupPostCount}
                              </div>
                            </div>
                          ) : (
                            <span className="italic text-stone-400">No update submitted</span>
                          )}
                        </td>
                        {/* Gap analysis column */}
                        <td className="py-3.5 px-4 align-top">
                          {row.hasGap ? (
                            <div className="space-y-1 max-w-sm">
                              <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 uppercase">
                                <AlertTriangle size={10} />
                                Gap Detected
                              </span>
                              <p className="text-xs font-semibold text-stone-700 mt-1">
                                {row.gapSummary}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                                ✓ Consistent
                              </span>
                              {row.gapSummary && (
                                <p className="text-xs text-stone-500 mt-1 italic">{row.gapSummary}</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
