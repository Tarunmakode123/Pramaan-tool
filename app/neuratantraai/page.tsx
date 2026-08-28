'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/app/components/Header';
import { Download, AlertTriangle, CheckCircle, Filter, RefreshCw, BarChart2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface ActivityItem {
  activityType: string;
  platform: string | null;
  description: string;
  count: number | null;
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

  // State filters (default to 30 days)
  const [filterStartDate, setFilterStartDate] = useState(getPastDateString(30));
  const [filterEndDate, setFilterEndDate] = useState(getTodayString());
  const [filterPerson, setFilterPerson] = useState('All');
  const [filterAccount, setFilterAccount] = useState('All');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairedData, setPairedData] = useState<PairedRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});

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

  // Extract unique submitters
  const uniquePeople = useMemo(() => {
    const people = new Set<string>(['Yogesh', 'Yogita']);
    pairedData.forEach((row) => {
      if (row.person) people.add(row.person);
    });
    return Array.from(people);
  }, [pairedData]);

  // Filter local dataset
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

  // Key KPI Stats
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const gaps = filteredRows.filter((row) => row.hasGap).length;
    const complete = filteredRows.filter((row) => row.plan && row.update).length;
    const complianceRate = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, gaps, complianceRate };
  }, [filteredRows]);

  // Expand / Collapse actions
  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Visual Heatmap Matrix
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

  // Platform share data processing
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

  // Dynamic Activity Chart calculations
  const chartData = useMemo(() => {
    // 1. Gather all dates and activity types
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

    // Dynamic color palette mapping
    const colorPalette = [
      '#EA580C', // orange
      '#1C1917', // charcoal
      '#E7E5E4', // stone
      '#FDBA74', // light orange
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#8B5CF6', // purple
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
      'ActivityType',
      'Platform',
      'PlannedCount',
      'PlannedDescription',
      'ActualCount',
      'ActualDescription',
      'DiscrepancyType',
      'AI Gap Summary',
    ];

    const csvRows: any[][] = [];

    filteredRows.forEach((row) => {
      const planItems = row.plan?.activityItems || [];
      const updateItems = row.update?.activityItems || [];

      // Match items in memory for flattening
      const matchedUpdates = new Set<number>();

      planItems.forEach((pItem) => {
        const pType = pItem.activityType.toLowerCase().trim();
        const pPlat = (pItem.platform || '').toLowerCase().trim();

        // Search match
        let updateIdx = -1;
        const match = updateItems.find((uItem, idx) => {
          const uType = uItem.activityType.toLowerCase().trim();
          const uPlat = (uItem.platform || '').toLowerCase().trim();
          if (uType === pType && uPlat === pPlat && !matchedUpdates.has(idx)) {
            updateIdx = idx;
            return true;
          }
          return false;
        });

        if (match) {
          matchedUpdates.add(updateIdx);
          const isVariance = pItem.count !== null && match.count !== null && match.count < pItem.count;
          csvRows.push([
            row.date,
            row.person,
            row.account,
            pItem.activityType,
            pItem.platform || 'General',
            pItem.count ?? '',
            pItem.description,
            match.count ?? '',
            match.description,
            isVariance ? 'Variance' : 'Consistent',
            row.gapSummary || '',
          ]);
        } else {
          // Missing
          csvRows.push([
            row.date,
            row.person,
            row.account,
            pItem.activityType,
            pItem.platform || 'General',
            pItem.count ?? '',
            pItem.description,
            '',
            '',
            'Missing in Update',
            row.gapSummary || '',
          ]);
        }
      });

      // Write any remaining update items not present in plan
      updateItems.forEach((uItem, idx) => {
        if (!matchedUpdates.has(idx)) {
          csvRows.push([
            row.date,
            row.person,
            row.account,
            uItem.activityType,
            uItem.platform || 'General',
            '',
            '',
            uItem.count ?? '',
            uItem.description,
            'No Plan Item',
            row.gapSummary || '',
          ]);
        }
      });

      // If both plan and update are missing entirely
      if (planItems.length === 0 && updateItems.length === 0) {
        csvRows.push([
          row.date,
          row.person,
          row.account,
          'N/A',
          'N/A',
          '',
          'No items',
          '',
          'No items',
          'No submissions',
          row.gapSummary || '',
        ]);
      }
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

  // Stacked chart dynamic height configuration
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase">Submissions (Days)</span>
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

        {/* Filters */}
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

        {/* Charts & Grid Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          {/* Dynamic SVG Stacked Bar Chart */}
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
                        {/* Dates Labels */}
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
                  {/* Grid base line */}
                  <line x1="0" y1={chartHeight} x2="100%" y2={chartHeight} stroke="#E7E5E4" strokeWidth="1" />
                </svg>

                {/* Dynamic Chart Legend */}
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

          {/* Platform Share horizontal bar charts */}
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
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm mb-8">
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

        {/* Detailed Expandable Table */}
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-stone-800">Oversight Records & AI Gaps</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Detailed side-by-side comparison of planned vs. actual numbers with automated gap analysis. Click a row to expand details.
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
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 overflow-x-auto">
            {loading ? (
              <p className="text-center py-6 text-sm text-stone-400">Analyzing logs & fetching Gemini gap summaries...</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-center py-6 text-sm text-stone-400">No submissions found in selected range.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50/50">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Person & Account</th>
                    <th className="py-3 px-4 text-center">Plan Total</th>
                    <th className="py-3 px-4 text-center">Update Total</th>
                    <th className="py-3 px-4">Oversight Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {filteredRows.map((row) => {
                    const rowKey = `${row.date}-${row.person}-${row.account}`;
                    const isExpanded = !!expandedRows[rowKey];
                    const planCount = row.plan?.activityItems?.length || 0;
                    const updateCount = row.update?.activityItems?.length || 0;

                    return (
                      <>
                        <tr
                          key={rowKey}
                          onClick={() => toggleRow(rowKey)}
                          className={`cursor-pointer hover:bg-stone-50 transition-all ${
                            row.hasGap ? 'bg-orange-50/20 hover:bg-orange-50/40' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 text-stone-400">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-stone-700 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-stone-800 text-xs">{row.person}</div>
                            <div className="text-[10px] font-semibold text-stone-400">{row.account}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-stone-600">
                            {planCount} tasks
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-brand-primary">
                            {updateCount} tasks
                          </td>
                          <td className="py-3.5 px-4">
                            {row.hasGap ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[9px] font-bold text-orange-800 uppercase shrink-0">
                                  <AlertTriangle size={9} />
                                  Gap
                                </span>
                                <span className="text-xs font-semibold text-stone-700 line-clamp-1">
                                  {row.gapSummary}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase">
                                ✓ Consistent
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded details panel */}
                        {isExpanded && (
                          <tr className="bg-stone-50/40">
                            <td colSpan={6} className="py-4 px-6 border-b border-stone-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Plan Details */}
                                <div>
                                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 border-b border-stone-200 pb-1">
                                    Planned Activities
                                  </h4>
                                  {row.plan ? (
                                    <div className="space-y-3">
                                      {row.plan.activityItems.map((item, idx) => (
                                        <div key={idx} className="bg-white p-2.5 rounded border border-stone-200 text-xs">
                                          <div className="flex justify-between font-bold text-stone-800">
                                            <span>{item.activityType} {item.platform && `[${item.platform}]`}</span>
                                            {item.count !== null && <span className="text-stone-500">Target: {item.count}</span>}
                                          </div>
                                          <p className="text-stone-600 mt-1">{item.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-stone-400 italic">No plan logged for this date.</p>
                                  )}
                                </div>

                                {/* Update Details */}
                                <div>
                                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 border-b border-stone-200 pb-1">
                                    Completed Activities (Updates)
                                  </h4>
                                  {row.update ? (
                                    <div className="space-y-3">
                                      {row.update.activityItems.map((item, idx) => (
                                        <div key={idx} className="bg-white p-2.5 rounded border border-stone-200 text-xs">
                                          <div className="flex justify-between font-bold text-brand-primary">
                                            <span>{item.activityType} {item.platform && `[${item.platform}]`}</span>
                                            {item.count !== null && <span className="text-stone-500">Reported: {item.count}</span>}
                                          </div>
                                          <p className="text-stone-600 mt-1">{item.description}</p>
                                        </div>
                                      ))}
                                      {row.update.rawText && (
                                        <div className="bg-stone-50 p-2.5 rounded border border-stone-200 text-[10px] font-mono text-stone-500 max-h-24 overflow-y-auto">
                                          <strong className="block text-[9px] uppercase tracking-wider text-stone-400 mb-1">Raw Evidence:</strong>
                                          {row.update.rawText}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-stone-400 italic">No evening update logged for this date.</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
