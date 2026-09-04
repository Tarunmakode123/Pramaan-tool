'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/app/components/Header';
import { Send, CheckCircle2, AlertCircle, FileText, Filter, ClipboardList } from 'lucide-react';

interface ActivityItem {
  activityType: string;
  platform: string | null;
  description: string;
  count: number | null;
  isPostable: boolean;
  verifiedStatus: 'unreviewed' | 'verified' | 'disputed' | 'not_independently_verifiable';
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

interface FormState {
  date: string;
  person: string;
  customPerson: string;
  account: string;
  entryType: 'Plan' | 'Update';
  rawText: string;
}

export default function TechnoHandsWorkspace() {
  const getTodayString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzoffset).toISOString().slice(0, 10);
  };

  const initialFormState: FormState = {
    date: getTodayString(),
    person: 'Yogesh',
    customPerson: '',
    account: 'Neuratantra',
    entryType: 'Plan',
    rawText: '',
  };

  const [form, setForm] = useState<FormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Plan reference query state
  const [planReference, setPlanReference] = useState<Submission | null>(null);
  const [planRefLoading, setPlanRefLoading] = useState(false);
  const [planRefChecked, setPlanRefChecked] = useState(false);

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

  // Fetch plan reference for Update logging
  const checkPlanReference = useCallback(async (date: string, person: string, account: string) => {
    setPlanRefLoading(true);
    setPlanRefChecked(false);
    setPlanReference(null);
    try {
      const finalPerson = person === 'Other' ? form.customPerson.trim() : person;
      if (!finalPerson) return;
      
      const params = new URLSearchParams({
        date,
        person: finalPerson,
        account,
        entryType: 'Plan'
      });
      const res = await fetch(`/api/submissions?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success && data.data.length > 0) {
        setPlanReference(data.data[0]);
      }
    } catch (err) {
      console.error('Error fetching plan reference:', err);
    } finally {
      setPlanRefLoading(false);
      setPlanRefChecked(true);
    }
  }, [form.customPerson]);

  useEffect(() => {
    if (form.entryType === 'Update') {
      const finalPerson = form.person === 'Other' ? form.customPerson.trim() : form.person;
      if (form.date && finalPerson && form.account) {
        checkPlanReference(form.date, form.person, form.account);
      }
    } else {
      setPlanReference(null);
      setPlanRefChecked(false);
    }
  }, [form.entryType, form.date, form.person, form.customPerson, form.account, checkPlanReference]);

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

    if (!form.rawText.trim()) {
      setMessage({ type: 'error', text: 'Please type your log message before submitting.' });
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        date: form.date,
        person: finalPersonName,
        account: form.account,
        entryType: form.entryType,
        rawText: form.rawText.trim(),
      };

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Work log submitted successfully!' });
        setForm((prev) => ({
          ...prev,
          rawText: '',
        }));
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

  // History pairing
  const filteredHistory = () => {
    let result = [...history];
    if (filterAccount !== 'All') {
      result = result.filter((h) => h.account === filterAccount);
    }
    if (filterStartDate) {
      result = result.filter((h) => h.date >= filterStartDate);
    }
    if (filterEndDate) {
      result = result.filter((h) => h.date <= filterEndDate);
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

    result.forEach((sub) => {
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
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  };

  const pairedList = filteredHistory();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Header title="Pramaan" subtitle="प्रमाण" role="technohands" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main workspace */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan reference card (Conditional when logging Update) */}
            {form.entryType === 'Update' && planRefChecked && (
              <div className={`rounded-lg border p-5 shadow-sm bg-white ${planReference ? 'border-orange-200 bg-orange-50/10' : 'border-stone-200'}`}>
                <h3 className="text-sm font-bold text-stone-700 flex items-center gap-2">
                  <ClipboardList className="text-brand-primary" size={16} />
                  Today's Plan Reference
                </h3>
                {planRefLoading ? (
                  <p className="text-xs text-stone-400 mt-2">Checking for today's plan...</p>
                ) : planReference ? (
                  <div className="mt-3">
                    <p className="text-xs text-stone-700 bg-stone-50 p-2.5 rounded border border-stone-200 font-mono whitespace-pre-wrap">
                      {planReference.rawText}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 mt-2 italic">
                    No Plan found for this day — you can still submit.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <FileText className="text-brand-primary" size={20} />
                Daily Submission Log
              </h2>
              <p className="text-sm text-stone-500 mt-1">
                Select your metadata and type your update below.
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

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Meta Selectors */}
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
                      <option value="Other">Custom (Type Custom Name)</option>
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

                {/* Primary Textarea Input */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700">
                    {form.entryType === 'Plan' ? "Type what you're doing today" : "Type what you did today"}
                  </label>
                  <div className="mt-2">
                    <textarea
                      rows={6}
                      required
                      value={form.rawText}
                      onChange={(e) => setForm({ ...form, rawText: e.target.value })}
                      placeholder={
                        form.entryType === 'Plan'
                          ? "E.g. Today's Plan:\n- Instagram: 1 Reel on AI Agents\n- LinkedIn: 10 outreach connect requests\n- Join 3 growth groups"
                          : "E.g. Today's Update:\n- Posted 1 Reel on Instagram\n- Sent 10 candidate outreach DMs on LinkedIn\n- Joined 3 marketing groups and posted 2 updates"
                      }
                      className="w-full rounded-md border border-stone-200 p-3.5 text-sm text-stone-950 placeholder-stone-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !form.rawText.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-md bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
                  >
                    <Send size={15} />
                    {submitting ? 'Submitting Log...' : 'Submit Log'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Reference Info */}
          <div className="space-y-6">
            <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-stone-800">Quick Instructions</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Type your daily tasks naturally. Your message will be recorded as permanent evidence and processed for oversight.
              </p>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-stone-800">Your Submission History</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Past logs submitted by your team.
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

          <div className="mt-6 overflow-x-auto">
            {historyLoading ? (
              <p className="text-center py-6 text-sm text-stone-400">Loading history records...</p>
            ) : pairedList.length === 0 ? (
              <p className="text-center py-6 text-sm text-stone-400">No submissions found matching filters.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50/50">
                    <th className="py-3 px-4 w-32">Date</th>
                    <th className="py-3 px-4 w-32">Person</th>
                    <th className="py-3 px-4 w-40">Account</th>
                    <th className="py-3 px-4 text-center bg-stone-100/30">Plan</th>
                    <th className="py-3 px-4 text-center bg-brand-accent/20">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {pairedList.map((row) => {
                    const key = `${row.date}-${row.person}-${row.account}`;
                    return (
                      <tr key={key} className="hover:bg-stone-50/50">
                        <td className="py-3.5 px-4 font-medium text-stone-700 whitespace-nowrap align-top">
                          {row.date}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap align-top">
                          {row.person}
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap align-top">
                          {row.account}
                        </td>
                        <td className="py-3.5 px-4 bg-stone-100/10 text-xs text-stone-600 align-top">
                          {row.plan ? (
                            <p className="font-mono whitespace-pre-wrap">{row.plan.rawText}</p>
                          ) : (
                            <span className="italic text-stone-400">No plan logged</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 bg-brand-accent/10 text-xs text-stone-700 align-top">
                          {row.update ? (
                            <p className="font-mono whitespace-pre-wrap">{row.update.rawText}</p>
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
