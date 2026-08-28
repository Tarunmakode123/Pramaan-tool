import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pramaan (प्रमाण) — Work Log & Evidence Dashboard',
  description: 'Daily Vendor Work Log & Evidence Dashboard for NeuraTantraAI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-brand-bg text-brand-text">
        {children}
      </body>
    </html>
  );
}
