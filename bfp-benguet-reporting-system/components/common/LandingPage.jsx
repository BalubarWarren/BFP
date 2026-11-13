'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Flame, BarChart3, QrCode, ArrowRight, Search, FileEdit, Clock, CheckCircle2,
  ShieldCheck, Building2, Landmark, ScanLine, MapPin, Bell, Lock, ChevronDown, User,
} from 'lucide-react';
import BFPCrest from './BFPCrest';

// The review chain every investigation report walks through — the same four stages the in-app
// progress tracker and the public QR tracking page show.
const WORKFLOW = [
  {
    icon: User,
    role: 'Investigator',
    action: 'Files the report',
    detail:
      'The fire investigator fills in the report on site or at the station, attaches the signed documents, and submits it. A tracking QR code is issued right away.',
  },
  {
    icon: Search,
    role: 'Municipal Chief IIS',
    action: 'First review',
    detail:
      'The Municipal Chief IIS checks the report for completeness. They either approve it, or return it to the investigator with remarks on what to fix.',
  },
  {
    icon: Building2,
    role: 'Municipal Fire Marshal',
    action: 'Station sign-off',
    detail:
      'Once approved at the first level, the investigator forwards it to the Municipal Fire Marshal for the station-level sign-off.',
  },
  {
    icon: Landmark,
    role: 'Provincial Chief IIS',
    action: 'Final approval',
    detail:
      'The Provincial Chief IIS gives final approval. The report becomes an official BFP Benguet record, viewable in the provincial archive.',
  },
];

const REPORT_TYPES = [
  {
    key: 'mdfir',
    icon: FileEdit,
    name: 'MDFIR',
    full: 'Minimal Damage Fire Incident Report',
    when: 'For small fires with minimal damage that need a quick, standalone record.',
    starts: 'Starts a new report',
  },
  {
    key: 'spot',
    icon: Search,
    name: 'Spot',
    full: 'Spot Investigation Report',
    when: 'Filed after the on-site investigation. Opens a new fire case with its own reference number.',
    starts: 'Opens a new case',
  },
  {
    key: 'progress',
    icon: Clock,
    name: 'Progress',
    full: 'Progress Investigation Report',
    when: 'Updates an ongoing case. Started directly from the approved Spot Investigation.',
    starts: 'Continues the case',
  },
  {
    key: 'final',
    icon: CheckCircle2,
    name: 'Final',
    full: 'Final Investigation Report',
    when: 'Closes the case with the investigation’s findings. Started from the approved Spot or Progress report.',
    starts: 'Closes the case',
  },
];

const FEATURES = [
  {
    icon: Flame,
    title: 'Incident Logging',
    description: 'Log fire incidents with location, category, and responding units, all in one place.',
  },
  {
    icon: MapPin,
    title: 'Live Location of Every Report',
    description: 'See at a glance whose desk a report is on and what it needs to move forward.',
  },
  {
    icon: QrCode,
    title: 'QR Tracking',
    description: 'Every report gets a QR code. Scan it to see its current stage, without the contents.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Investigators and reviewers are alerted the moment a report is approved, returned, or forwarded.',
  },
  {
    icon: BarChart3,
    title: 'Provincial Dashboard',
    description: 'Incident counts, fire maps, and monitoring boards across every Benguet municipality.',
  },
  {
    icon: Lock,
    title: 'Role-Based Access',
    description: 'Each officer sees only what their role needs. Every review action is logged.',
  },
];

// Accepts the full link from a QR code ("https://…/verify/<token>") or just the token itself.
const extractTrackingToken = (input) => {
  const value = input.trim();
  if (!value) return '';
  const match = value.match(/\/verify\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{16,}$/.test(value) ? value : '';
};

export default function LandingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [activeType, setActiveType] = useState(REPORT_TYPES[0].key);
  const [trackInput, setTrackInput] = useState('');
  const [trackError, setTrackError] = useState('');

  // Walk through the review chain on its own until the visitor picks a step themselves.
  useEffect(() => {
    if (!autoPlay) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setActiveStep((step) => (step + 1) % WORKFLOW.length), 3500);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const pickStep = (index) => {
    setAutoPlay(false);
    setActiveStep(index);
  };

  const handleTrack = (e) => {
    e.preventDefault();
    const token = extractTrackingToken(trackInput);
    if (!token) {
      setTrackError('Paste the link from the report’s QR code, or scan the code with your phone camera.');
      return;
    }
    setTrackError('');
    router.push(`/verify/${token}`);
  };

  const step = WORKFLOW[activeStep];
  const StepIcon = step.icon;
  const type = REPORT_TYPES.find((t) => t.key === activeType);
  const TypeIcon = type.icon;

  return (
    <div className="min-h-screen flex flex-col bg-bfp-navy text-white">
      <div className="h-1.5 w-full hazard-trim" />

      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-bfp-navy/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <BFPCrest size={32} />
            <span className="font-bold tracking-wide">FIRETRACK</span>
          </div>
          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#reports" className="hover:text-white transition-colors">Reports</a>
            <a href="#track" className="hover:text-white transition-colors">Track a report</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="whitespace-nowrap rounded border border-white/70 px-4 py-2 sm:px-5 text-sm font-semibold transition-colors hover:bg-white hover:text-bfp-navy"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="landing-hero relative overflow-hidden">
        <div className="landing-embers" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ left: `${(i * 73) % 100}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${6 + (i % 5)}s` }} />
          ))}
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-16 pt-14 text-center sm:pt-20">
          <div className="landing-crest mb-6">
            <BFPCrest size={92} />
          </div>
          <p className="mb-3 rounded-full border border-bfp-gold/40 bg-bfp-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-bfp-gold">
            Bureau of Fire Protection &middot; Benguet
          </p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">
            Every fire report, <span className="text-bfp-gold">tracked</span> from the field to final approval.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-white/65 sm:text-lg">
            FireTrack lets investigators file incident reports and shows everyone exactly where each
            report is in the review chain, and who is checking it right now.
          </p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/login"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-bfp-red px-7 py-3 font-semibold shadow-lg shadow-black/30 transition-all hover:bg-red-700 hover:shadow-xl sm:w-auto"
            >
              Access System Portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#track"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-bfp-gold px-7 py-3 font-semibold transition-colors hover:bg-bfp-gold hover:text-bfp-navy sm:w-auto"
            >
              <ScanLine className="h-4 w-4" /> Track a Report
            </a>
          </div>
          <a href="#how-it-works" className="mt-12 text-white/40 hover:text-white/80 transition-colors" aria-label="Scroll to how it works">
            <ChevronDown className="h-6 w-6 landing-bounce" />
          </a>
        </div>
      </header>

      {/* How it works — interactive review chain */}
      <section id="how-it-works" className="scroll-mt-20 bg-white text-bfp-navy">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-bfp-red">How it works</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">The path of a report</h2>
          <p className="mt-2 max-w-2xl text-gray-600">
            Every investigation report passes through four desks. Tap a stage to see what happens there.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4" role="tablist" aria-label="Review stages">
            {WORKFLOW.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === activeStep;
              const isDone = i < activeStep;
              return (
                <button
                  key={s.role}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => pickStep(i)}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-bfp-red bg-bfp-red/5 shadow-lg -translate-y-1'
                      : isDone
                        ? 'border-bfp-green/40 bg-bfp-green/5 hover:border-bfp-green'
                        : 'border-gray-200 hover:border-bfp-navy/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        isActive ? 'bg-bfp-red text-white' : isDone ? 'bg-bfp-green text-white' : 'bg-gray-100 text-bfp-navy'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <span className="text-xs font-bold text-gray-400">STEP {i + 1}</span>
                  </div>
                  <p className="mt-3 font-bold leading-tight">{s.role}</p>
                  <p className="text-sm text-gray-500">{s.action}</p>
                  {isActive && autoPlay && (
                    <span className="landing-progress absolute bottom-0 left-0 h-1 rounded-bl-xl bg-bfp-red" />
                  )}
                </button>
              );
            })}
          </div>

          <div key={activeStep} className="landing-fade mt-5 flex flex-col gap-4 rounded-xl bg-bfp-navy p-6 text-white sm:flex-row sm:items-center">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-bfp-gold/15 text-bfp-gold">
              <StepIcon className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-bfp-gold">
                Step {activeStep + 1} &middot; {step.role}
              </p>
              <p className="mt-1 text-white/80">{step.detail}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pickStep((activeStep + WORKFLOW.length - 1) % WORKFLOW.length)}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => pickStep((activeStep + 1) % WORKFLOW.length)}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-bfp-navy hover:bg-bfp-gold"
              >
                Next
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Returned at any stage? The report goes back to the investigator with remarks, then resumes from where it left off.
          </p>
        </div>
      </section>

      {/* Report types */}
      <section id="reports" className="scroll-mt-20 bg-gray-50 text-bfp-navy">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-bfp-red">Reports</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">One case, step by step</h2>
          <p className="mt-2 max-w-2xl text-gray-600">
            A Spot Investigation opens the case. Progress and Final reports continue it, started with one click from the approved report.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <div className="flex flex-col gap-2" role="tablist" aria-label="Report types">
              {REPORT_TYPES.map((t, i) => {
                const Icon = t.icon;
                const isActive = t.key === activeType;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveType(t.key)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                      isActive ? 'border-bfp-navy bg-bfp-navy text-white shadow-md' : 'border-gray-200 bg-white hover:border-bfp-navy/40'
                    }`}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-bfp-gold' : 'text-bfp-red'}`} />
                    <span className="flex-1 font-semibold">{t.full}</span>
                    {i > 1 && <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-white/60' : 'text-gray-400'}`}>Follow-up</span>}
                  </button>
                );
              })}
            </div>

            <div key={type.key} className="landing-fade rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-bfp-red/10 text-bfp-red">
                  <TypeIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xl font-bold">{type.name}</p>
                  <p className="text-sm text-gray-500">{type.full}</p>
                </div>
              </div>
              <p className="mt-4 text-gray-700">{type.when}</p>

              {/* Case flow: Spot → Progress → Final, with MDFIR shown on its own */}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold">
                {type.key === 'mdfir' ? (
                  <span className="rounded-full bg-bfp-red px-3 py-1 text-white">MDFIR (standalone)</span>
                ) : (
                  ['spot', 'progress', 'final'].map((k, i) => {
                    const t = REPORT_TYPES.find((r) => r.key === k);
                    return (
                      <span key={k} className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 ${k === type.key ? 'bg-bfp-red text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {t.name}
                        </span>
                        {i < 2 && <ArrowRight className="h-3.5 w-3.5 text-gray-400" />}
                      </span>
                    );
                  })
                )}
              </div>
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-bfp-gold/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                {type.starts}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Track a report */}
      <section id="track" className="scroll-mt-20 bg-bfp-navy-light">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-bfp-gold">Track a report</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Where is my report now?</h2>
            <p className="mt-3 text-white/70">
              Scan the QR code on a report with your phone camera, or paste its link here. You&rsquo;ll see
              which stage it&rsquo;s at and who is checking it. No login needed, and the report&rsquo;s
              contents stay private.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/80">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-bfp-gold" /> Current stage and who has it</li>
              <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-bfp-gold" /> Full history of approvals and returns</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-bfp-gold" /> Confirms when it becomes an official record</li>
            </ul>
          </div>

          <form onSubmit={handleTrack} className="rounded-xl bg-white p-6 text-bfp-navy shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-bfp-navy text-bfp-gold">
                <QrCode className="h-6 w-6" />
              </span>
              <div>
                <p className="font-bold">Report tracking link</p>
                <p className="text-xs text-gray-500">From the report&rsquo;s QR code</p>
              </div>
            </div>
            <label htmlFor="track-input" className="sr-only">Report tracking link</label>
            <input
              id="track-input"
              type="text"
              value={trackInput}
              onChange={(e) => {
                setTrackInput(e.target.value);
                if (trackError) setTrackError('');
              }}
              placeholder="https://…/verify/…"
              className="form-input mt-4 w-full"
              autoComplete="off"
            />
            {trackError && <p className="mt-2 text-sm text-bfp-red">{trackError}</p>}
            <button type="submit" className="btn btn-primary mt-4 w-full inline-flex items-center justify-center gap-2">
              Track Report <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="bg-bfp-navy">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8">
          <h2 className="text-2xl font-bold sm:text-3xl">Built for the whole province</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-bfp-gold/60 hover:bg-white/10"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-bfp-gold transition-colors group-hover:bg-bfp-gold group-hover:text-bfp-navy">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border border-bfp-gold/30 bg-gradient-to-r from-bfp-red/20 to-transparent p-6 text-center sm:flex-row sm:text-left">
            <div className="flex-1">
              <p className="text-lg font-bold">Authorized BFP Benguet personnel</p>
              <p className="text-sm text-white/60">Sign in with your FireTrack account to file and review reports.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-bfp-gold px-6 py-3 font-semibold text-bfp-navy transition-colors hover:bg-white"
            >
              Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#0d131c] px-6 py-5 text-center text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Bureau of Fire Protection - Benguet. For official use only.
      </footer>
    </div>
  );
}
