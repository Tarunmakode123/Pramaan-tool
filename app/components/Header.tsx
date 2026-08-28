'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  role: 'technohands' | 'neuratantraai';
}

export default function Header({ title, subtitle, role }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        router.refresh();
        router.push(`/${role}/login`);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <header className="border-b border-stone-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-brand-primary leading-none">
              {title}
            </h1>
            <span className="text-[10px] font-semibold tracking-widest text-stone-400 uppercase mt-0.5">
              {subtitle}
            </span>
          </div>
          <div className="h-6 w-[1px] bg-stone-200 mx-2" />
          <span className="rounded bg-brand-accent px-2.5 py-1 text-xs font-semibold text-brand-primary">
            {role === 'technohands' ? 'TechnoHands Solution (Vendor)' : 'NeuraTantraAI (Oversight)'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-md border border-stone-200 px-3.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-brand-primary transition-all duration-200"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </header>
  );
}
