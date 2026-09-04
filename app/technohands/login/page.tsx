'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function TechnoHandsLogin() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode, role: 'technohands' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        window.location.href = data.redirectUrl;
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-primary leading-none">
            Pramaan
          </h1>
          <span className="text-xs font-semibold tracking-widest text-stone-400 uppercase mt-1 block">
            प्रमाण
          </span>
          <h2 className="mt-4 text-lg font-semibold text-stone-700">
            TechnoHands Solution Workspace
          </h2>
          <p className="mt-1 text-sm text-stone-400">
            Enter your vendor passcode to access the daily work submission panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-700">
              Passcode
            </label>
            <div className="relative mt-1">
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-stone-200 px-4 py-2.5 pl-10 text-stone-950 placeholder-stone-300 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <Lock className="absolute left-3.5 top-3 text-stone-400" size={16} />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600 bg-red-50 p-2.5 rounded-md">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-primary py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? 'Authenticating...' : 'Access Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
