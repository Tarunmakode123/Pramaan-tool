'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import { Sparkles, CheckCircle2, AlertCircle, Calendar, User, FileText, Filter } from 'lucide-react';

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

interface FormState {
  date: string;
  person: string;
  customPerson: string;
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

export default function TechnoHandsWorkspace() {
  const getTodayString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  const initialFormState: FormState = {
    date: getTodayString(),
    person: 'Yogesh',
    customPerson: '',
    account: 'Neuratantra',
    entryType: 'Plan',
    platform: 'Instagram',
    postType: 'Graphic',
    postCount: 0,
    outreachCount: 0,
    pollsPosted: 0,
    groupsJoined: 0,
    groupPostCount: 0,
    engagementNotes: '',
    contentCreationNotes: '',
    rawText: '',
    parsedByAI: false,
  };

  const [form, setForm] = useState<FormState>(initialFormState);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // History State
  const [history, setHistory] = useState<Submission[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterAccount, setFilterAccount] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/submissions');
      const data = await res.json();
      if (res.ok && data.success) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to load submissions history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleParse = async () => {
    if (!form.rawText.trim()) {
      setMessage({ type: 'error', text: 'Please paste raw update text to parse with AI.' });
      return;
    }

    setParsing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: form.rawText }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const parsed = data.data;
        setForm((prev) => ({
          ...prev,
          platform: parsed.platform || '',
          postType: parsed.postType || '',
          postCount: Number(parsed.postCount) || 0,
          outreachCount: Number(parsed.outreachCount) || 0,
          pollsPosted: Number(parsed.pollsPosted) || 0,
          groupsJoined: Number(parsed.groupsJoined) || 0,
          groupPostCount: Number(parsed.groupPostCount) || 0,
          engagementNotes: parsed.engagementNotes || '',
          contentCreationNotes: parsed.contentCreationNotes || '',
          parsedByAI: true,
        }));
        setMessage({ type: 'success', text: 'Text parsed successfully! Review the fields below and submit.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to parse text.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error contacting AI parser.' });
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const finalPersonName = form.person === 'Other' ? form.customPerson.trim() : form.person;

    if (!finalPersonName) {
      setMessage({ type: 'error', text: 'Please enter a person name.' });
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        date: form.date,
        person: finalPersonName,
        account: form.account,
        entryType: form.entryType,
        platform: form.platform,
        postType: form.postType,
        postCount: form.postCount,
        outreachCount: form.outreachCount,
        pollsPosted: form.pollsPosted,
        groupsJoined: form.groupsJoined,
        groupPostCount: form.groupPostCount,
        engagementNotes: form.engagementNotes,
        contentCreationNotes: form.contentCreationNotes,
        rawText: form.rawText || `Submitted manually by ${finalPersonName}`,
        parsedByAI: form.parsedByAI,
      };

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Work log submitted successfully to Google Sheet!' });
        setForm({
          ...initialFormState,
          person: form.person, // Keep the last selected person to reduce clicks
          customPerson: form.customPerson,
          account: form.account, // Keep the account too
        });
        fetchHistory();
      } else {
        setMessage({ type: 'error', text: data.error || 'Submission failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error submitting log.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Grouping submissions for historical pairing view
  const getPairedHistory = () => {
    let filtered = [...history];

    if (filterAccount !== 'All') {
      filtered = filtered.filter((h) => h.account === filterAccount);
    }
    if (filterStartDate) {
      filtered = filtered.filter((h) => h.date >= filterStartDate);
    }
    if (filterEndDate) {
      filtered = filtered.filter((h) => h.date <= filterEndDate);
    }

    const groups: {
      [key: string]: {
        date: string;
        person: string;
        account: string;
        plan?: Submission;
        update?: Submission;
      };
    } = {};

    filtered.forEach((sub) => {
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

    const list = Object.values(groups);
    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  };

  const pairedList = getPairedHistory();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Header title="Pramaan" subtitle="प्रमाण" role="technohands" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Submission Form Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <FileText className="text-brand-primary" size={20} />
                Daily Submission Log
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Fill the fields manually or paste your raw WhatsApp message and parse with AI.
              </p>

              {message && (
                <div
                  className={`mt-4 flex items-start gap-2.5 rounded-md p-3.5 text-sm font-medium ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                  ) : (
                    <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Step 1: AI Parser */}
              <div className="mt-6 border-b border-stone-100 pb-6">
                <label className="block text-sm font-semibold text-stone-700">
                  Paste WhatsApp Update (Optional AI Parsing)
                </label>
                <div className="mt-2.5">
                  <textarea
                    rows={4}
                    value={form.rawText}
                    onChange={(e) => setForm({ ...form, rawText: e.target.value })}
                    placeholder="Paste the daily WhatsApp message here. E.g.&#10;Yogesh Update:&#10;- Instagram: 1 Reel published&#10;- LinkedIn: 5 outreach candidate connects&#10;- Joined 3 groups, shared 2 posts"
                    className="w-full rounded-md border border-stone-200 p-3 text-sm text-stone-950 placeholder-stone-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleParse}
                    disabled={parsing || !form.rawText.trim()}
                    className="flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-orange-100 disabled:opacity-50 transition-all duration-200"
                  >
                    <Sparkles size={15} />
                    {parsing ? 'Parsing with Gemini...' : 'Parse with AI'}
                  </button>
                </div>
              </div>

              {/* Step 2: Form Fields */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Meta details */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700">Reporting Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3.5 py-2 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-stone-700">Account Name</label>
                    <select
                      value={form.account}
                      onChange={(e) => setForm({ ...form, account: e.target.value })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3.5 py-2 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    >
                      <option value="Neuratantra">Neuratantra</option>
                      <option value="AI by Vaibhav Jain">AI by Vaibhav Jain</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700">Person</label>
                    <select
                      value={form.person}
                      onChange={(e) => setForm({ ...form, person: e.target.value })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3.5 py-2 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    >
                      <option value="Yogesh">Yogesh</option>
                      <option value="Yogita">Yogita</option>
                      <option value="Other">Other (Add Custom Name)</option>
                    </select>
                    {form.person === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter name"
                        required
                        value={form.customPerson}
                        onChange={(e) => setForm({ ...form, customPerson: e.target.value })}
                        className="mt-2 w-full rounded-md border border-stone-200 px-3.5 py-2 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-stone-700">Entry Type</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, entryType: 'Plan' })}
                        className={`flex-1 rounded-l-md border px-4 py-2 text-sm font-semibold transition-all ${
                          form.entryType === 'Plan'
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Plan (Morning)
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, entryType: 'Update' })}
                        className={`flex-1 rounded-r-md border-t border-b border-r px-4 py-2 text-sm font-semibold transition-all ${
                          form.entryType === 'Update'
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        Update (Evening)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Metrics Fields */}
                <h3 className="text-sm font-bold text-stone-800 pt-3 border-t border-stone-100 uppercase tracking-wider">
                  Marketing Metrics
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Platform</label>
                    <input
                      type="text"
                      value={form.platform}
                      onChange={(e) => setForm({ ...form, platform: e.target.value })}
                      placeholder="Instagram, LinkedIn..."
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Post Type</label>
                    <input
                      type="text"
                      value={form.postType}
                      onChange={(e) => setForm({ ...form, postType: e.target.value })}
                      placeholder="Reel, Carousel, Graphic..."
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Post Count</label>
                    <input
                      type="number"
                      min={0}
                      value={form.postCount}
                      onChange={(e) => setForm({ ...form, postCount: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Outreach count</label>
                    <input
                      type="number"
                      min={0}
                      value={form.outreachCount}
                      onChange={(e) => setForm({ ...form, outreachCount: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Polls Posted</label>
                    <input
                      type="number"
                      min={0}
                      value={form.pollsPosted}
                      onChange={(e) => setForm({ ...form, pollsPosted: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Groups Joined</label>
                    <input
                      type="number"
                      min={0}
                      value={form.groupsJoined}
                      onChange={(e) => setForm({ ...form, groupsJoined: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Group Posts</label>
                    <input
                      type="number"
                      min={0}
                      value={form.groupPostCount}
                      onChange={(e) => setForm({ ...form, groupPostCount: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Engagement Notes</label>
                    <textarea
                      rows={2}
                      value={form.engagementNotes}
                      onChange={(e) => setForm({ ...form, engagementNotes: e.target.value })}
                      placeholder="Commented on 5 key profiles..."
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-500">Content Creation Notes</label>
                    <textarea
                      rows={2}
                      value={form.contentCreationNotes}
                      onChange={(e) => setForm({ ...form, contentCreationNotes: e.target.value })}
                      placeholder="Designed graphic for post #2..."
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-950 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto rounded-md bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
                  >
                    {submitting ? 'Submitting...' : 'Confirm & Submit to Sheet'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Submission Info / Guidelines */}
          <div className="space-y-6">
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-stone-800">WhatsApp Formatting Reference</h3>
              <p className="text-xs text-stone-500 mt-1">
                You can write updates normally. Use these templates as references for best AI parsing:
              </p>
              <div className="mt-4 rounded bg-stone-50 p-3 text-xs text-stone-600 font-mono space-y-3">
                <div>
                  <span className="font-semibold text-brand-primary block">Plan Example:</span>
                  "Plan: Instagram Graphic, 1 post. LinkedIn outreach 10 connect requests. Join 3 growth groups."
                </div>
                <div>
                  <span className="font-semibold text-brand-primary block">Update Example:</span>
                  "Update: Posted 1 Instagram graphic. Sent 10 LinkedIn candidate messages. Joined 3 groups, shared 3 posts. Handled DM engagement."
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-stone-800">Quick Links</h3>
              <p className="text-xs text-stone-500 mt-1">Access dashboard or documentation</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <a
                    href="/neuratantraai"
                    target="_blank"
                    className="text-brand-primary hover:underline font-semibold"
                  >
                    Go to Oversight Dashboard &rarr;
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section: Self History Table */}
        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-stone-800">Your Submission History</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Past logs submitted by TechnoHands. Paired Plan vs. Update metrics.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <Filter size={14} />
                <span>Filters:</span>
              </div>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-900 bg-white"
              >
                <option value="All">All Accounts</option>
                <option value="Neuratantra">Neuratantra</option>
                <option value="AI by Vaibhav Jain">AI by Vaibhav Jain</option>
              </select>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                placeholder="Start Date"
                className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-900 bg-white"
              />
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                placeholder="End Date"
                className="rounded border border-stone-200 px-2 py-1 text-xs text-stone-900 bg-white"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="mt-6 overflow-x-auto">
            {historyLoading ? (
              <p className="text-center py-6 text-sm text-stone-400">Loading history records...</p>
            ) : pairedList.length === 0 ? (
              <p className="text-center py-6 text-sm text-stone-400">No submissions found matching filters.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50/50">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Person</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4 text-center bg-stone-100/30">Plan Metrics</th>
                    <th className="py-3 px-4 text-center bg-brand-accent/20">Update Metrics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {pairedList.map((row, idx) => {
                    const key = `${row.date}-${row.person}-${row.account}`;
                    return (
                      <tr key={key} className="hover:bg-stone-50/50">
                        <td className="py-3.5 px-4 font-medium text-stone-700 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap">
                          {row.person}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap">
                          {row.account}
                        </td>
                        {/* Plan Metrics */}
                        <td className="py-3.5 px-4 bg-stone-100/10 text-xs text-stone-600">
                          {row.plan ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-stone-800">
                                Posts: {row.plan.postCount} ({row.plan.postType || 'N/A'})
                              </div>
                              <div>Outreach: {row.plan.outreachCount}</div>
                              <div>Polls: {row.plan.pollsPosted} | Groups: {row.plan.groupsJoined}</div>
                              {row.plan.platform && <div>Platform: {row.plan.platform}</div>}
                            </div>
                          ) : (
                            <span className="italic text-stone-400">No plan logged</span>
                          )}
                        </td>
                        {/* Update Metrics */}
                        <td className="py-3.5 px-4 bg-brand-accent/10 text-xs text-stone-700">
                          {row.update ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-brand-primary">
                                Posts: {row.update.postCount} ({row.update.postType || 'N/A'})
                              </div>
                              <div>Outreach: {row.update.outreachCount}</div>
                              <div>Polls: {row.update.pollsPosted} | Groups: {row.update.groupsJoined} ({row.update.groupPostCount} posts)</div>
                              {row.update.engagementNotes && (
                                <div className="text-stone-500 italic mt-1 line-clamp-2">
                                  Eng: {row.update.engagementNotes}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-stone-400">No update logged</span>
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
