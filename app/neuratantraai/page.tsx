'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/app/components/Header';
import { Download, AlertTriangle, CheckCircle2, Filter, RefreshCw, BarChart2, Table, Check, X, ShieldAlert } from 'lucide-react';

interface ActivityItem {
  activityType: string;
  platform: string | null;
  description: string;
  count: number | null;
  isPostable: boolean;
  verifiedStatus: 'unreviewed' | 'verified' | 'disputed' | 'not_independently_verifiable';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

interface Submission {
  timestamp: string;
  date: string;
  person: string;
  account: string;
  entryType: 'Plan' | 'Update';
  rawText: string;
  parsedByAI: boolean;
  activityItems: ActivityItem[];
}

interface GroupedRow {
  date: string;
  person: string;
  account: string;
  plan: Submission | null;
  update: Submission | null;
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

  // View state: 'table' (Primary) vs 'insights' (Secondary)
  const [activeTab, setActiveTab] = useState<'table' | 'insights'>('table');

  // Filters
  const [filterStartDate, setFilterStartDate] = useState(getPastDateString(30));
  const [filterEndDate, setFilterEndDate] = useState(getTodayString());
  const [filterPerson, setFilterPerson] = useState('All');
  const [filterAccount, setFilterAccount] = useState('All');
  const [filterEntryType, setFilterEntryType] = useState('All');
  const [filterActivityType, setFilterActivityType] = useState('All');
  const [filterOnlyUnreviewed, setFilterOnlyUnreviewed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [groupedData, setGroupedData] = useState<GroupedRow[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setGroupedData(data.data);
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

  // Extract unique submitters & activity types for filter dropdowns
  const uniquePeople = useMemo(() => {
    const people = new Set<string>(['Yogesh', 'Yogita']);
    groupedData.forEach((row) => {
      if (row.person) people.add(row.person);
    });
    return Array.from(people);
  }, [groupedData]);

  const uniqueActivityTypes = useMemo(() => {
    const types = new Set<string>();
    groupedData.forEach((row) => {
      [row.plan, row.update].forEach((sub) => {
        sub?.activityItems?.forEach((item) => {
          if (item.activityType) types.add(item.activityType);
        });
      });
    });
    return Array.from(types);
  }, [groupedData]);

  // Handle Verify / Dispute action
  const handleVerifyToggle = async (
    date: string,
    person: string,
    account: string,
    entryType: string,
    itemIndex: number,
    newStatus: 'verified' | 'disputed' | 'unreviewed'
  ) => {
    const key = `${date}-${person}-${account}-${entryType}-${itemIndex}`;
    setVerifyingKey(key);
    try {
      const res = await fetch('/api/verify-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          person,
          account,
          entryType,
          itemIndex,
          verifiedStatus: newStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Update state locally
        setGroupedData((prev) =>
          prev.map((row) => {
            if (row.date === date && row.person === person && row.account === account) {
              const sub = entryType === 'Plan' ? row.plan : row.update;
              if (sub && sub.activityItems && sub.activityItems[itemIndex]) {
                const updatedItems = [...sub.activityItems];
                updatedItems[itemIndex] = {
                  ...updatedItems[itemIndex],
                  verifiedStatus: newStatus,
                  verifiedBy: 'NeuraTantraAI Reviewer',
                  verifiedAt: new Date().toISOString(),
                };
                return {
                  ...row,
                  [entryType.toLowerCase()]: {
                    ...sub,
                    activityItems: updatedItems,
                  },
                };
              }
            }
            return row;
          })
        );
      } else {
        alert(data.error || 'Failed to update verification status.');
      }
    } catch (err) {
      alert('Error connecting to server.');
    } finally {
      setVerifyingKey(null);
    }
  };

  // Filter client-side rows based on dropdowns & queue filter
  const filteredRows = useMemo(() => {
    let result = [...groupedData];

    if (filterPerson !== 'All') {
      result = result.filter((row) => row.person === filterPerson);
    }
    if (filterAccount !== 'All') {
      result = result.filter((row) => row.account === filterAccount);
    }
    if (filterEntryType !== 'All') {
      if (filterEntryType === 'Plan') result = result.filter((row) => !!row.plan);
      if (filterEntryType === 'Update') result = result.filter((row) => !!row.update);
    }

    if (filterActivityType !== 'All') {
      result = result.filter((row) => {
        const hasPlanMatch = row.plan?.activityItems?.some((i) => i.activityType === filterActivityType);
        const hasUpdateMatch = row.update?.activityItems?.some((i) => i.activityType === filterActivityType);
        return hasPlanMatch || hasUpdateMatch;
      });
    }

    if (filterOnlyUnreviewed) {
      result = result.filter((row) => {
        const hasUnreviewedPostablePlan = row.plan?.activityItems?.some((i) => i.isPostable && i.verifiedStatus === 'unreviewed');
        const hasUnreviewedPostableUpdate = row.update?.activityItems?.some((i) => i.isPostable && i.verifiedStatus === 'unreviewed');
        return hasUnreviewedPostablePlan || hasUnreviewedPostableUpdate;
      });
    }

    return result;
  }, [groupedData, filterPerson, filterAccount, filterEntryType, filterActivityType, filterOnlyUnreviewed]);

  // Key Stats
  const stats = useMemo(() => {
    let totalSubmissions = 0;
    let unreviewedCount = 0;
    let verifiedCount = 0;
    let disputedCount = 0;

    groupedData.forEach((row) => {
      [row.plan, row.update].forEach((sub) => {
        if (sub) {
          totalSubmissions++;
          sub.activityItems?.forEach((item) => {
            if (item.isPostable) {
              if (item.verifiedStatus === 'unreviewed') unreviewedCount++;
              if (item.verifiedStatus === 'verified') verifiedCount++;
              if (item.verifiedStatus === 'disputed') disputedCount++;
            }
          });
        }
      });
    });

    return { totalSubmissions, unreviewedCount, verifiedCount, disputedCount };
  }, [groupedData]);

  // Platform share data processing for Insights
  const platformStats = useMemo(() => {
    const counts: { [key: string]: number } = {};
    let total = 0;

    filteredRows.forEach((row) => {
      const updateItems = row.update?.activityItems || [];
      updateItems.forEach((item) => {
        const plat = item.platform || 'General/Other';
        counts[plat] = (counts[plat] || 0) + 1;
        total++;
      });
    });

    const list = Object.entries(counts).map(([name, val]) => ({
      name,
      count: val,
      percentage: total > 0 ? Math.round((val / total) * 100) : 0,
    }));
    list.sort((a, b) => b.count - a.count);
    return { list, total };
  }, [filteredRows]);

  // Consistency heatmap data
  const consistencyData = useMemo(() => {
    if (!filterStartDate || !filterEndDate) return { dates: [], grid: {} };

    const datesList: string[] = [];
    const current = new Date(filterStartDate);
    const end = new Date(filterEndDate);
    while (current <= end) {
      datesList.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    datesList.reverse();

    const grid: { [person: string]: { [date: string]: { plan: boolean; update: boolean } } } = {};
    const peopleList = filterPerson === 'All' ? uniquePeople : [filterPerson];
    
    peopleList.forEach((person) => {
      grid[person] = {};
      datesList.forEach((date) => {
        grid[person][date] = { plan: false, update: false };
      });
    });

    groupedData.forEach((row) => {
      const person = row.person;
      const date = row.date;
      if (grid[person] && grid[person][date]) {
        grid[person][date].plan = !!row.plan;
        grid[person][date].update = !!row.update;
      }
    });

    return { dates: datesList, grid };
  }, [groupedData, filterStartDate, filterEndDate, filterPerson, uniquePeople]);

  // Dynamic Chart calculations
  const chartData = useMemo(() => {
    const dateMap: { [date: string]: { [type: string]: number } } = {};
    const dynamicTypes = new Set<string>();
    
    filteredRows.forEach((row) => {
      const updateItems = row.update?.activityItems || [];
      updateItems.forEach((item) => {
        const type = item.activityType || 'General';
        dynamicTypes.add(type);
        if (!dateMap[row.date]) {
          dateMap[row.date] = {};
        }
        dateMap[row.date][type] = (dateMap[row.date][type] || 0) + 1;
      });
    });

    const dates = Object.keys(dateMap).sort();
    const types = Array.from(dynamicTypes);

    const colorPalette = [
      '#EA580C', '#1C1917', '#E7E5E4', '#FDBA74', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'
    ];

    const typeColors: { [type: string]: string } = {};
    types.forEach((type, idx) => {
      typeColors[type] = colorPalette[idx % colorPalette.length];
    });

    return { dates, types, dateMap, typeColors };
  }, [filteredRows]);

  // Flattened CSV Export
  const handleExport = () => {
    const headers = [
      'Date',
      'Person',
      'Account',
      'EntryType',
      'RawText',
      'ActivityType',
      'Platform',
      'Count',
      'Description',
      'IsPostable',
      'VerifiedStatus',
      'VerifiedBy',
      'VerifiedAt',
    ];

    const csvRows: any[][] = [];

    filteredRows.forEach((row) => {
      [row.plan, row.update].forEach((sub) => {
        if (sub) {
          if (sub.activityItems && sub.activityItems.length > 0) {
            sub.activityItems.forEach((item) => {
              csvRows.push([
                row.date,
                row.person,
                row.account,
                sub.entryType,
                sub.rawText,
                item.activityType,
                item.platform || 'General',
                item.count ?? '',
                item.description,
                item.isPostable ? 'TRUE' : 'FALSE',
                item.verifiedStatus,
                item.verifiedBy || '',
                item.verifiedAt || '',
              ]);
            });
          } else {
            csvRows.push([
              row.date,
              row.person,
              row.account,
              sub.entryType,
              sub.rawText,
              'General',
              '',
              '',
              '',
              'FALSE',
              'not_independently_verifiable',
              '',
              '',
            ]);
          }
        }
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(','),
        ...csvRows.map((r) =>
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

  const chartHeight = 180;
  const maxStackHeight = useMemo(() => {
    let max = 5;
    chartData.dates.forEach((date) => {
      let sum = 0;
      chartData.types.forEach((type) => {
        sum += chartData.dateMap[date][type] || 0;
      });
      if (sum > max) max = sum;
    });
    return max + 1;
  }, [chartData]);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Header title="Pramaan" subtitle="प्रमाण" role="neuratantraai" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* KPI Panel */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 mb-8">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Submissions</span>
              <h3 className="text-3xl font-extrabold text-stone-900 mt-1">{stats.totalSubmissions}</h3>
            </div>
            <div className="rounded bg-brand-accent p-2.5 text-brand-primary">
              <Table size={22} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Unreviewed Queue</span>
              <h3 className={`text-3xl font-extrabold mt-1 ${stats.unreviewedCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                {stats.unreviewedCount}
              </h3>
            </div>
            <div className={`rounded p-2.5 ${stats.unreviewedCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-400'}`}>
              <ShieldAlert size={22} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Verified Items</span>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.verifiedCount}</h3>
            </div>
            <div className="rounded bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Disputed Items</span>
              <h3 className={`text-3xl font-extrabold mt-1 ${stats.disputedCount > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                {stats.disputedCount}
              </h3>
            </div>
            <div className={`rounded p-2.5 ${stats.disputedCount > 0 ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-400'}`}>
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3 mb-4 gap-3">
            <div className="flex items-center gap-2">
              <Filter className="text-brand-primary" size={18} />
              <h2 className="text-md font-bold text-stone-800">Oversight Filters</h2>
            </div>
            {/* Unreviewed Queue Toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all">
              <input
                type="checkbox"
                checked={filterOnlyUnreviewed}
                onChange={(e) => setFilterOnlyUnreviewed(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span>Show unreviewed postable items queue</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Person</label>
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
              <label className="block text-xs font-bold text-stone-500 uppercase">Account</label>
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
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase">Activity Type</label>
              <select
                value={filterActivityType}
                onChange={(e) => setFilterActivityType(e.target.value)}
                className="mt-1 w-full rounded border border-stone-200 px-3 py-1.5 text-sm text-stone-950 bg-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="All">All Task Types</option>
                {uniqueActivityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Primary / Secondary View Switcher Tabs */}
        <div className="flex items-center justify-between border-b border-stone-200 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-all ${
                activeTab === 'table'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Table size={16} />
              Date-Wise Audit Table (Primary)
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-bold transition-all ${
                activeTab === 'insights'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <BarChart2 size={16} />
              Visual Insights & Heatmap (Secondary)
            </button>
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

        {/* Tab 1: Primary Date-Wise Table */}
        {activeTab === 'table' && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-stone-500 mb-4">
              Ground truth raw text shown alongside parsed fields. Check real account to verify postable items.
            </p>

            {error && (
              <div className="mb-4 rounded bg-red-50 p-3.5 text-sm font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <p className="text-center py-8 text-sm text-stone-400">Loading audit records...</p>
              ) : filteredRows.length === 0 ? (
                <p className="text-center py-8 text-sm text-stone-400">No submissions matching selected filters.</p>
              ) : (
                <div className="space-y-6">
                  {filteredRows.map((row) => {
                    const rowKey = `${row.date}-${row.person}-${row.account}`;
                    return (
                      <div key={rowKey} className="rounded-lg border border-stone-200 bg-stone-50/30 p-5 space-y-4">
                        {/* Header info */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-3 gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-stone-900 text-sm">{row.date}</span>
                            <span className="h-4 w-[1px] bg-stone-300" />
                            <span className="font-semibold text-stone-700 text-xs">{row.person}</span>
                            <span className="h-4 w-[1px] bg-stone-300" />
                            <span className="font-medium text-stone-500 text-xs">{row.account}</span>
                          </div>
                        </div>

                        {/* Side by side comparison: Plan vs Update */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Plan Side */}
                          <div className="bg-white p-4 rounded-md border border-stone-200 space-y-3">
                            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block border-b border-stone-100 pb-1">
                              Plan Entry
                            </span>
                            {row.plan ? (
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Ground Truth RawText:</span>
                                  <p className="text-xs font-mono bg-stone-50 p-2.5 rounded border border-stone-200 text-stone-800 whitespace-pre-wrap">
                                    {row.plan.rawText}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Parsed Activity Items:</span>
                                  <ul className="space-y-2">
                                    {row.plan.activityItems?.map((item, idx) => {
                                      const itemKey = `${row.date}-${row.person}-${row.account}-Plan-${idx}`;
                                      const isPending = verifyingKey === itemKey;

                                      return (
                                        <li key={idx} className="bg-stone-50/70 p-2.5 rounded border border-stone-200 text-xs space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-stone-800">
                                              {item.activityType} {item.platform && `[${item.platform}]`}
                                            </span>
                                            {item.count !== null && <span className="text-stone-500 font-semibold">Count: {item.count}</span>}
                                          </div>
                                          <p className="text-stone-600">{item.description}</p>

                                          {/* Verification Badge / Controls */}
                                          <div className="pt-1.5 flex items-center justify-between border-t border-stone-200/60">
                                            {item.isPostable ? (
                                              <div className="flex items-center gap-2 w-full justify-between">
                                                {item.verifiedStatus === 'verified' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                                    <CheckCircle2 size={11} /> Verified
                                                  </span>
                                                )}
                                                {item.verifiedStatus === 'disputed' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                                    <AlertTriangle size={11} /> Disputed
                                                  </span>
                                                )}
                                                {item.verifiedStatus === 'unreviewed' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                    🟡 Unreviewed (Check Account)
                                                  </span>
                                                )}

                                                <div className="flex items-center gap-1">
                                                  <button
                                                    onClick={() => handleVerifyToggle(row.date, row.person, row.account, 'Plan', idx, 'verified')}
                                                    disabled={isPending}
                                                    className="rounded bg-emerald-600 hover:bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white transition-all"
                                                  >
                                                    <Check size={11} className="inline mr-0.5" /> Verify
                                                  </button>
                                                  <button
                                                    onClick={() => handleVerifyToggle(row.date, row.person, row.account, 'Plan', idx, 'disputed')}
                                                    disabled={isPending}
                                                    className="rounded bg-red-600 hover:bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white transition-all"
                                                  >
                                                    <X size={11} className="inline mr-0.5" /> Dispute
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                                                ⚪ Logged (Private / Unverifiable)
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-stone-400 italic">No plan logged for this date.</p>
                            )}
                          </div>

                          {/* Update Side */}
                          <div className="bg-white p-4 rounded-md border border-stone-200 space-y-3">
                            <span className="text-xs font-bold text-brand-primary uppercase tracking-wider block border-b border-stone-100 pb-1">
                              Update Entry (Reported Work)
                            </span>
                            {row.update ? (
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Ground Truth RawText:</span>
                                  <p className="text-xs font-mono bg-brand-accent/20 p-2.5 rounded border border-brand-accent/50 text-stone-900 whitespace-pre-wrap">
                                    {row.update.rawText}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1">Parsed Activity Items:</span>
                                  <ul className="space-y-2">
                                    {row.update.activityItems?.map((item, idx) => {
                                      const itemKey = `${row.date}-${row.person}-${row.account}-Update-${idx}`;
                                      const isPending = verifyingKey === itemKey;

                                      return (
                                        <li key={idx} className="bg-stone-50/70 p-2.5 rounded border border-stone-200 text-xs space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-brand-primary">
                                              {item.activityType} {item.platform && `[${item.platform}]`}
                                            </span>
                                            {item.count !== null && <span className="text-stone-500 font-semibold">Reported: {item.count}</span>}
                                          </div>
                                          <p className="text-stone-600">{item.description}</p>

                                          {/* Verification Badge / Controls */}
                                          <div className="pt-1.5 flex items-center justify-between border-t border-stone-200/60">
                                            {item.isPostable ? (
                                              <div className="flex items-center gap-2 w-full justify-between">
                                                {item.verifiedStatus === 'verified' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                                    <CheckCircle2 size={11} /> Verified
                                                  </span>
                                                )}
                                                {item.verifiedStatus === 'disputed' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                                    <AlertTriangle size={11} /> Disputed
                                                  </span>
                                                )}
                                                {item.verifiedStatus === 'unreviewed' && (
                                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                    🟡 Unreviewed (Check Account)
                                                  </span>
                                                )}

                                                <div className="flex items-center gap-1">
                                                  <button
                                                    onClick={() => handleVerifyToggle(row.date, row.person, row.account, 'Update', idx, 'verified')}
                                                    disabled={isPending}
                                                    className="rounded bg-emerald-600 hover:bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white transition-all"
                                                  >
                                                    <Check size={11} className="inline mr-0.5" /> Verify
                                                  </button>
                                                  <button
                                                    onClick={() => handleVerifyToggle(row.date, row.person, row.account, 'Update', idx, 'disputed')}
                                                    disabled={isPending}
                                                    className="rounded bg-red-600 hover:bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white transition-all"
                                                  >
                                                    <X size={11} className="inline mr-0.5" /> Dispute
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
                                                ⚪ Logged (Private / Unverifiable)
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-stone-400 italic">No evening update logged for this date.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Secondary Visual Insights */}
        {activeTab === 'insights' && (
          <div className="space-y-8">
            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Stacked SVG Chart */}
              <div className="lg:col-span-2 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">
                  Activity Volume Over Time
                </h3>
                {chartData.dates.length === 0 ? (
                  <div className="h-[210px] flex items-center justify-center text-xs text-stone-400 italic">
                    No activity data to display.
                  </div>
                ) : (
                  <div>
                    <svg width="100%" height={chartHeight + 35} className="overflow-visible">
                      {chartData.dates.map((date, xIdx) => {
                        const barWidth = Math.max(12, Math.min(30, 400 / chartData.dates.length));
                        const spacing = 100 / chartData.dates.length;
                        const xPos = `${xIdx * spacing + spacing / 2}%`;
                        
                        let yOffset = 0;
                        return (
                          <g key={date} className="group cursor-pointer">
                            {chartData.types.map((type) => {
                              const count = chartData.dateMap[date][type] || 0;
                              if (count === 0) return null;
                              
                              const height = (count / maxStackHeight) * chartHeight;
                              const yPos = chartHeight - yOffset - height;
                              yOffset += height;
                              
                              return (
                                <rect
                                  key={type}
                                  x={`calc(${xPos} - ${barWidth / 2}px)`}
                                  y={yPos}
                                  width={barWidth}
                                  height={height}
                                  fill={chartData.typeColors[type]}
                                  className="transition-all hover:opacity-85"
                                >
                                  <title>{`${date} - ${type}: ${count} reported`}</title>
                                </rect>
                              );
                            })}
                            {xIdx % Math.ceil(chartData.dates.length / 8) === 0 && (
                              <text
                                x={xPos}
                                y={chartHeight + 18}
                                textAnchor="middle"
                                className="text-[9px] font-semibold fill-stone-400"
                              >
                                {date.slice(5)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                      <line x1="0" y1={chartHeight} x2="100%" y2={chartHeight} stroke="#E7E5E4" strokeWidth="1" />
                    </svg>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-3 border-t border-stone-100">
                      {chartData.types.map((type) => (
                        <div key={type} className="flex items-center gap-1.5 text-xs text-stone-600">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: chartData.typeColors[type] }}
                          />
                          <span>{type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Platform Share */}
              <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4">
                  Platform Share Breakdown
                </h3>
                {platformStats.list.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-stone-400 italic">
                    No platform metrics logged.
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                    {platformStats.list.map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-stone-700">{item.name}</span>
                          <span className="text-stone-400 font-bold">{item.count} items ({item.percentage}%)</span>
                        </div>
                        <div className="h-2 w-full rounded bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Heatmap matrix */}
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-stone-800">Submission Consistency Matrix</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Green = Both Submitted | Orange = Plan Only | Amber = Update Only | Grey = Missed
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
          </div>
        )}
      </main>
    </div>
  );
}
