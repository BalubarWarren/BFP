'use client';

import Link from 'next/link';
import { Flame, Database, BarChart3 } from 'lucide-react';
import BFPCrest from './BFPCrest';

const FEATURES = [
  {
    icon: Flame,
    title: 'Incident Logging',
    description: 'Securely input and track live fire incident data, location details, and dispatch timelines.',
  },
  {
    icon: Database,
    title: 'Data Management',
    description: 'Centralized storage for easy retrieval of historical incident records and field evidence.',
  },
  {
    icon: BarChart3,
    title: 'Automated Reporting',
    description: 'Instantly generate official, standardized BFP formatted reports for documentation.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-bfp-navy-light to-bfp-navy">
      {/* Hazard stripe */}
      <div className="h-1.5 w-full hazard-trim" />

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <BFPCrest size={32} />
          <span className="font-bold tracking-wide text-white">BFP BENGUET</span>
        </div>
        <Link
          href="/login"
          className="rounded border border-white/70 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-bfp-navy"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-5">
          <BFPCrest size={84} />
        </div>
        <h1 className="max-w-2xl text-3xl font-bold tracking-wide text-white sm:text-4xl">
          Fire Incident Reporting System
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/60">
          A centralized platform for authorized personnel to log incidents, manage evidence, and
          generate official dispatch reports for the Bureau of Fire Protection - Benguet.
        </p>
        <Link
          href="/login"
          className="mt-7 rounded-lg border-2 border-bfp-gold px-8 py-3 font-semibold text-white transition-colors hover:bg-bfp-gold hover:text-bfp-navy"
        >
          Access System Portal
        </Link>
      </main>

      {/* Features */}
      <section className="grid grid-cols-1 gap-5 bg-black/20 px-6 py-10 sm:grid-cols-3 sm:px-10">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-lg border-t-2 border-bfp-gold bg-white/5 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-bfp-gold">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-bold text-bfp-gold">{title}</h3>
            <p className="text-sm leading-relaxed text-white/60">{description}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="bg-[#0d131c] px-6 py-5 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Bureau of Fire Protection - Benguet. For official use only.
      </footer>
    </div>
  );
}
