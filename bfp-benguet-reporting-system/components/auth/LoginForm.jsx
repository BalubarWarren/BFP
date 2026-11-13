'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ArrowLeft, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import BFPCrest from '../common/BFPCrest';
import GoogleSignInButton from './GoogleSignInButton';
import ForgotPasswordForm from './ForgotPasswordForm';
import GoogleAccountWarningModal from './GoogleAccountWarningModal';

export default function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  toggleShowPassword,
  error,
  loading,
  handleSubmit,
  handleGoogleCredential,
  googleUser,
  clearGoogleUser,
  showForgotPassword,
  openForgotPassword,
  closeForgotPassword,
  googleWarning,
  closeGoogleWarning,
  switchToPasswordLogin,
}) {
  // The password field is already mounted when Google fills in the account, so autoFocus
  // wouldn't fire — move the cursor there explicitly instead.
  const passwordRef = useRef(null);
  useEffect(() => {
    if (googleUser) passwordRef.current?.focus();
  }, [googleUser]);

  // The browser's password manager would otherwise fill in a saved email/password as soon as the
  // page loads — so after logging out, the last user's password sat in the form. Browsers don't
  // autofill read-only fields, so each field starts read-only and unlocks the moment it's focused
  // (the user can still pick a saved login from the browser's list themselves).
  const [unlocked, setUnlocked] = useState({ email: false, password: false });
  const unlock = (field) => () => setUnlocked((current) => (current[field] ? current : { ...current, [field]: true }));

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2 dark:bg-gray-950">
      {/* Brand panel (desktop) */}
      <aside className="landing-hero relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute inset-x-0 top-0 h-1 hazard-trim" />
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-white/90 hover:text-white">
          <BFPCrest size={30} /> FIRETRACK
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Every fire report, tracked to final approval.
          </h1>
          <p className="mt-4 text-white/65">
            File incident reports and see exactly where each one is in the review chain, and who is checking it.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-bfp-gold" /> Live location of every report</li>
            <li className="flex items-center gap-2.5"><QrCode className="h-4 w-4 text-bfp-gold" /> QR tracking without exposing contents</li>
            <li className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-bfp-gold" /> Role-based access, every action logged</li>
          </ul>
        </div>
        <p className="text-xs text-white/40">Bureau of Fire Protection &mdash; Benguet. For official use only.</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <Link href="/" className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-900">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      <div className="mx-auto my-auto w-full max-w-sm py-10">
        {/* Logo/Header */}
        <div className="mb-8">
          <div className="mb-5 lg:hidden">
            <BFPCrest size={48} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in to FireTrack</h2>
          <p className="mt-1 text-sm text-gray-500">Fire Incident Report Tracking System &middot; BFP Benguet</p>
        </div>

        <div>
          {showForgotPassword ? (
            <ForgotPasswordForm initialEmail={googleUser?.email || email} onBack={closeForgotPassword} />
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} autoComplete="off">
                {googleUser ? (
                  // Google already identified the account — only the system password is left to enter.
                  <div className="form-group">
                    <label className="form-label">Account</label>
                    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="min-w-0">
                        {googleUser.name && <p className="font-semibold text-bfp-navy truncate">{googleUser.name}</p>}
                        <p className="text-sm text-gray-600 truncate">{googleUser.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearGoogleUser}
                        className="shrink-0 text-sm font-medium text-bfp-navy hover:underline"
                      >
                        Not you?
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the FireTrack password given by your administrator (not your Google password).
                    </p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="your.email@bfp-benguet.gov.ph"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      readOnly={!unlocked.email}
                      onFocus={unlock('email')}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label className="form-label">Password</label>
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-sm font-medium text-bfp-navy hover:underline mb-1"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input pr-10"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      ref={passwordRef}
                      autoComplete="off"
                      readOnly={!unlocked.password}
                      onFocus={unlock('password')}
                      required
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-bfp-navy"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary mb-4 h-10 w-full"
                >
                  {loading && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                  )}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Matches GoogleSignInButton's own check (it renders nothing without a configured
                  client ID) — otherwise this "or" divider would show with nothing below it. */}
              {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && !googleUser && (
                <>
                  <div className="flex items-center gap-3 my-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400">or continue with</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <GoogleSignInButton onCredential={handleGoogleCredential} />
                </>
              )}
            </>
          )}
        </div>
      </div>
      </main>

      {googleWarning && (
        <GoogleAccountWarningModal
          warning={googleWarning}
          onClose={closeGoogleWarning}
          onUsePassword={switchToPasswordLogin}
        />
      )}
    </div>
  );
}
