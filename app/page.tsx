import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-xl text-center space-y-8">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-brand-primary leading-none">
            Pramaan
          </h1>
          <span className="text-sm font-semibold tracking-widest text-stone-400 uppercase mt-1.5 block">
            प्रमाण
          </span>
          <p className="mt-4 text-stone-500 max-w-md mx-auto text-sm">
            Daily Vendor Work Log & Evidence Dashboard. Secure portals for TechnoHands submission and NeuraTantraAI oversight.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/technohands"
            className="group rounded-lg border border-stone-200 bg-white p-6 shadow-sm hover:border-brand-primary transition-all text-left"
          >
            <h3 className="text-md font-bold text-stone-800 group-hover:text-brand-primary">
              Vendor Portal &rarr;
            </h3>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Workspace for TechnoHands Solution to submit daily morning plans and evening updates.
            </p>
          </Link>

          <Link
            href="/neuratantraai"
            className="group rounded-lg border border-stone-200 bg-white p-6 shadow-sm hover:border-brand-primary transition-all text-left"
          >
            <h3 className="text-md font-bold text-stone-800 group-hover:text-brand-primary">
              Oversight Portal &rarr;
            </h3>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Oversight dashboard for NeuraTantraAI to monitor submissions and audit work logs.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
